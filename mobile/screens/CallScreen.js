import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { getSocket } from '../services/socket';

function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallScreen({ route, navigation }) {
  const { remote, isIncoming, callerId, socket: _socket } = route.params;
  const socket = getSocket();

  const [state, setState]  = useState(isIncoming ? 'incoming' : 'calling');
  const [muted, setMuted]  = useState(false);
  const [timer, setTimer]  = useState(0);
  const timerRef           = useRef(null);
  const pulse              = useRef(new Animated.Value(1)).current;

  // Pulse animation for incoming/calling ring
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true, easing: Easing.ease }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true, easing: Easing.ease }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
  };

  const endCall = useCallback((notify = true) => {
    clearInterval(timerRef.current);
    if (notify) socket?.emit('voice-call-end', { recipientId: callerId || remote?.id });
    navigation.goBack();
  }, [socket, callerId]);

  const accept = useCallback(() => {
    socket?.emit('voice-call-accept', { callerId });
    setState('active');
    startTimer();
  }, [socket, callerId]);

  const reject = useCallback(() => {
    socket?.emit('voice-call-reject', { callerId });
    navigation.goBack();
  }, [socket, callerId]);

  useEffect(() => {
    socket?.on('voice-call-accepted', () => { setState('active'); startTimer(); });
    socket?.on('voice-call-rejected', () => endCall(false));
    socket?.on('voice-call-ended',    () => endCall(false));
    return () => {
      socket?.off('voice-call-accepted');
      socket?.off('voice-call-rejected');
      socket?.off('voice-call-ended');
    };
  }, [socket, endCall]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const callerName = remote?.name || 'Unknown';

  return (
    <View style={styles.container}>
      {/* Pulsing avatar */}
      <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulse }] }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{callerName[0]?.toUpperCase()}</Text>
        </View>
      </Animated.View>

      <Text style={styles.name}>{callerName}</Text>
      <Text style={styles.status}>
        {state === 'incoming' ? 'Incoming call…'
         : state === 'calling' ? 'Calling…'
         : formatTime(timer)}
      </Text>

      {/* Controls */}
      {state === 'incoming' ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.rejectBtn} onPress={reject}>
            <Text style={styles.btnIcon}>📵</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={accept}>
            <Text style={styles.btnIcon}>📞</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.actionBtn, muted ? styles.muteActive : {}]}
            onPress={() => setMuted(m => !m)}
          >
            <Text style={styles.btnIcon}>{muted ? '🔇' : '🎙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => endCall(true)}>
            <Text style={styles.btnIcon}>📵</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#050619', alignItems: 'center', justifyContent: 'center', gap: 20 },
  avatarWrap:  { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(99,102,241,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatar:      { width: 100, height: 100, borderRadius: 50, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  avatarLetter:{ fontSize: 42, fontWeight: '800', color: '#fff' },
  name:        { fontSize: 28, fontWeight: '800', color: '#fff' },
  status:      { fontSize: 16, color: '#9ca3af' },
  row:         { flexDirection: 'row', gap: 40, marginTop: 32 },
  acceptBtn:   { width: 72, height: 72, borderRadius: 36, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
  rejectBtn:   { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  actionBtn:   { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  muteActive:  { backgroundColor: 'rgba(239,68,68,0.2)' },
  btnIcon:     { fontSize: 30 },
});
