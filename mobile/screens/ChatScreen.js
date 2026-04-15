import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getMessages, sendMessage, uploadFile } from '../services/api';
import { getSocket } from '../services/socket';

function fmtTime(d) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Bubble({ msg, isMine }) {
  return (
    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
      {msg.type === 'text'
        ? <Text style={styles.msgText}>{msg.text}</Text>
        : msg.type === 'audio'
        ? <Text style={styles.msgText}>🎤 Voice note</Text>
        : msg.type === 'image'
        ? <Text style={styles.msgText}>📷 Photo</Text>
        : msg.type === 'video'
        ? <Text style={styles.msgText}>🎥 Video</Text>
        : <Text style={styles.msgText}>📎 {msg.fileName || 'Document'}</Text>
      }
      <Text style={styles.timestamp}>{fmtTime(msg.createdAt)}</Text>
    </View>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { conversation, currentUser } = route.params;
  const other = conversation.participants?.find(p => p._id !== currentUser?._id) || { username: 'User' };

  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [recording, setRecording] = useState(null);
  const flatRef = useRef(null);
  const socket  = getSocket();

  // Navigate title
  useEffect(() => { navigation.setOptions({ title: other.username }); }, []);

  // Load messages
  useEffect(() => {
    getMessages(conversation._id)
      .then(d => { setMessages(d.messages || []); setLoading(false); });
  }, []);

  // Real-time incoming
  useEffect(() => {
    const handler = ({ conversationId, message }) => {
      if (conversationId !== conversation._id) return;
      setMessages(p => p.some(m => m._id === message._id) ? p : [...p, message]);
    };
    socket?.on('receive-dm', handler);
    return () => socket?.off('receive-dm', handler);
  }, []);

  const send = useCallback(async (body) => {
    const opt = { _id: `opt-${Date.now()}`, senderName: currentUser.username, createdAt: new Date().toISOString(), _optimistic: true, ...body };
    setMessages(p => [...p, opt]);
    try {
      const data = await sendMessage(conversation._id, body);
      setMessages(p => p.map(m => m._id === opt._id ? data.message : m));
      socket?.emit('send-dm', { conversationId: conversation._id, recipientId: other._id, message: data.message });
    } catch {
      setMessages(p => p.filter(m => m._id !== opt._id));
    }
  }, []);

  const submitText = () => {
    if (!text.trim()) return;
    send({ type: 'text', text: text.trim() });
    setText('');
  };

  // Voice recording
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
    } catch { Alert.alert('Error', 'Could not start recording'); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    try {
      const upload = await uploadFile(uri, 'voice.m4a', 'audio/m4a');
      send({ type: 'audio', audioUrl: upload.url, duration: Math.round(upload.duration || 0) });
    } catch { Alert.alert('Upload failed'); }
  };

  // Image picker
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All });
    if (res.canceled) return;
    const asset = res.assets[0];
    const upload = await uploadFile(asset.uri, asset.fileName || 'upload', asset.mimeType || 'image/jpeg');
    send({ type: asset.mimeType?.startsWith('video') ? 'video' : 'image', fileUrl: upload.url, fileName: asset.fileName, fileSize: asset.fileSize });
  };

  // Document picker
  const pickDoc = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (res.canceled) return;
    const asset = res.assets[0];
    const upload = await uploadFile(asset.uri, asset.name, asset.mimeType);
    send({ type: 'document', fileUrl: upload.url, fileName: asset.name, fileSize: asset.size });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m._id}
        renderItem={({ item }) => <Bubble msg={item} isMine={item.senderName === currentUser?.username} />}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 12, paddingBottom: 4 }}
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={pickImage}  style={styles.iconBtn}><Text style={styles.iconEmoji}>📎</Text></TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor="#6b7280"
          multiline
        />
        {text.trim()
          ? <TouchableOpacity onPress={submitText} style={styles.sendBtn}><Text style={styles.sendIcon}>➤</Text></TouchableOpacity>
          : <TouchableOpacity onPress={recording ? stopRecording : startRecording} style={[styles.sendBtn, recording ? styles.recordingBtn : {}]}>
              <Text style={styles.sendIcon}>{recording ? '⏹' : '🎤'}</Text>
            </TouchableOpacity>
        }
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#05060f' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05060f' },
  bubble:       { maxWidth: '75%', marginVertical: 3, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMine:   { alignSelf: 'flex-end', backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  bubbleOther:  { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4 },
  msgText:      { color: '#fff', fontSize: 15, lineHeight: 20 },
  timestamp:    { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4, textAlign: 'right' },
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#0a0b15' },
  iconBtn:      { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  iconEmoji:    { fontSize: 20 },
  input:        { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 15, maxHeight: 100, marginHorizontal: 8 },
  sendBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  recordingBtn: { backgroundColor: '#ef4444' },
  sendIcon:     { color: '#fff', fontSize: 16 },
});
