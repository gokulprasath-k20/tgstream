import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getRequests, acceptRequest, rejectRequest } from '../services/api';
import { getSocket } from '../services/socket';

function Avatar({ name }) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#10b981','#f59e0b'];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <Text style={styles.avatarText}>{name?.[0]?.toUpperCase()}</Text>
    </View>
  );
}

export default function RequestsScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [proc, setProc]         = useState({});
  const socket = getSocket();

  const load = async () => {
    const data = await getRequests();
    setRequests(data.requests || []);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    socket?.on('new-contact-request', load);
    return () => socket?.off('new-contact-request', load);
  }, []);

  const accept = async (convId) => {
    setProc(p => ({ ...p, [convId]: 'a' }));
    try {
      const data = await acceptRequest(convId);
      setRequests(r => r.filter(req => req._id !== convId));
      Alert.alert('✅ Accepted', 'They are now in your contacts!');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setProc(p => { const n = { ...p }; delete n[convId]; return n; });
    }
  };

  const reject = async (convId) => {
    setProc(p => ({ ...p, [convId]: 'r' }));
    await rejectRequest(convId).catch(() => {});
    setRequests(r => r.filter(req => req._id !== convId));
    setProc(p => { const n = { ...p }; delete n[convId]; return n; });
  };

  const getOther = (req) => req.participants?.find(p => true) || { username: 'Unknown' };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Message Requests</Text>
        {requests.length > 0 && <Text style={styles.badge}>{requests.length}</Text>}
      </View>

      {requests.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📬</Text>
          <Text style={styles.emptyText}>No message requests</Text>
          <Text style={styles.emptySubtext}>When someone new messages you, it appears here for you to accept or decline.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={r => r._id}
          renderItem={({ item }) => {
            const other  = item.participants?.find(p => p._id !== item.requestedBy) || item.participants?.[0] || { username: 'User' };
            const sender = item.participants?.find(p => p._id === item.requestedBy) || { username: 'Someone' };
            const isProc = proc[item._id];
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Avatar name={sender.username} />
                  <View style={styles.info}>
                    <Text style={styles.name}>{sender.username}</Text>
                    <Text style={styles.sub}>Wants to message you</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => accept(item._id)} disabled={!!isProc}>
                    {isProc === 'a'
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.btnText}>✓ Accept</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(item._id)} disabled={!!isProc}>
                    <Text style={styles.rejectText}>✕ Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#05060f' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:       { fontSize: 24, fontWeight: '800', color: '#fff' },
  badge:       { backgroundColor: '#6366f1', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:   { fontSize: 48, marginBottom: 16 },
  emptyText:   { color: '#9ca3af', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtext:{ color: '#4b5563', textAlign: 'center', fontSize: 14, lineHeight: 22 },
  card:        { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, margin: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar:      { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontWeight: '700', fontSize: 20 },
  info:        { marginLeft: 14 },
  name:        { color: '#fff', fontWeight: '700', fontSize: 16 },
  sub:         { color: '#6b7280', fontSize: 13, marginTop: 2 },
  actions:     { flexDirection: 'row', gap: 10 },
  acceptBtn:   { flex: 1, backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  rejectBtn:   { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnText:     { color: '#fff', fontWeight: '700' },
  rejectText:  { color: '#9ca3af', fontWeight: '600' },
});
