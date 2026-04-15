import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getConversations, createConversation, searchUsers, getMe } from '../services/api';
import { getSocket } from '../services/socket';

function Avatar({ name, online }) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#10b981','#f59e0b','#06b6d4'];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <View style={{ position: 'relative' }}>
      <View style={[styles.avatarCircle, { backgroundColor: bg }]}>
        <Text style={styles.avatarText}>{name?.[0]?.toUpperCase() || '?'}</Text>
      </View>
      {online && <View style={styles.onlineDot} />}
    </View>
  );
}

function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(d).toLocaleDateString();
}

export default function ChatListScreen({ navigation }) {
  const [user, setUser]         = useState(null);
  const [convos, setConvos]     = useState([]);
  const [search, setSearch]     = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [searching, setSearching] = useState(false);
  const socket = getSocket();

  useFocusEffect(useCallback(() => {
    let timer;
    (async () => {
      const me   = await getMe();
      const data = await getConversations();
      setUser(me.user);
      setConvos(data.conversations || []);
      setLoading(false);
    })();

    const handleDM = ({ conversationId, message }) => {
      setConvos(p => {
        const upd = p.map(c => c._id === conversationId ? { ...c, lastMessage: { text: message.text || '', senderName: message.senderName, createdAt: message.createdAt } } : c);
        return [...upd].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    };
    socket?.on('receive-dm', handleDM);
    return () => { socket?.off('receive-dm', handleDM); clearTimeout(timer); };
  }, []));

  // User search for new conversations
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const d = await searchUsers(search);
      setResults(d.users || []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openConversation = async (recipientId, recipientName) => {
    const data = await createConversation(recipientId);
    setSearch('');
    setResults([]);
    navigation.navigate('Chat', { conversation: data.conversation, currentUser: user });
  };

  const getOther = (conv) => conv.participants?.find(p => p._id !== user?._id) || { username: 'Unknown' };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search users…"
        placeholderTextColor="#6b7280"
      />

      {/* Search results */}
      {search.trim() !== '' && (
        <FlatList
          data={results}
          keyExtractor={u => u._id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.item} onPress={() => openConversation(item._id, item.username)}>
              <Avatar name={item.username} />
              <Text style={styles.name}>{item.username}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={!searching ? <Text style={styles.empty}>No users found</Text> : null}
        />
      )}

      {/* Conversations */}
      {search.trim() === '' && (
        <FlatList
          data={convos}
          keyExtractor={c => c._id}
          renderItem={({ item }) => {
            const other = getOther(item);
            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() => navigation.navigate('Chat', { conversation: item, currentUser: user })}
              >
                <Avatar name={other.username} />
                <View style={styles.itemText}>
                  <View style={styles.itemRow}>
                    <Text style={styles.name}>{other.username}</Text>
                    <Text style={styles.time}>{timeAgo(item.lastMessage?.createdAt)}</Text>
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {item.lastMessage?.text || 'No messages yet'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No conversations yet. Search for a user to start chatting!</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#05060f' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05060f' },
  header:      { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  title:       { fontSize: 24, fontWeight: '800', color: '#fff' },
  search:      { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, marginHorizontal: 16, marginBottom: 8, padding: 12, color: '#fff', fontSize: 14 },
  item:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  itemText:    { flex: 1, marginLeft: 12 },
  itemRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  name:        { color: '#fff', fontWeight: '600', fontSize: 15 },
  preview:     { color: '#6b7280', fontSize: 13, marginTop: 2 },
  time:        { color: '#6b7280', fontSize: 11 },
  empty:       { color: '#4b5563', textAlign: 'center', marginTop: 40, paddingHorizontal: 32 },
  avatarCircle:{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontWeight: '700', fontSize: 18 },
  onlineDot:   { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#34d399', borderWidth: 2, borderColor: '#05060f' },
});
