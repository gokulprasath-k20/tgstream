import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getContactList, createConversation } from '../services/api';

function Avatar({ name }) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#10b981','#f59e0b'];
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <View style={[styles.avatar, { backgroundColor: bg }]}>
      <Text style={styles.avatarText}>{name?.[0]?.toUpperCase()}</Text>
    </View>
  );
}

export default function ContactsScreen({ navigation }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);

  useFocusEffect(useCallback(() => {
    getContactList()
      .then(d => { setContacts(d.contacts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []));

  const message = async (contact, currentUser) => {
    const data = await createConversation(contact._id);
    navigation.navigate('Chat', { conversation: data.conversation, currentUser });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366f1" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
        <Text style={styles.subtitle}>{contacts.length} people</Text>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>No contacts yet</Text>
          <Text style={styles.emptySub}>Accept message requests to add contacts.</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={c => c._id}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Avatar name={item.username} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.username}</Text>
              </View>
              <TouchableOpacity style={styles.msgBtn} onPress={() => message(item)}>
                <Text style={styles.msgIcon}>💬</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#05060f' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  title:       { fontSize: 24, fontWeight: '800', color: '#fff' },
  subtitle:    { color: '#6b7280', fontSize: 13, marginTop: 4 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:   { fontSize: 48, marginBottom: 16 },
  emptyText:   { color: '#9ca3af', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub:    { color: '#4b5563', textAlign: 'center', fontSize: 14 },
  item:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  avatar:      { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontWeight: '700', fontSize: 18 },
  info:        { flex: 1, marginLeft: 14 },
  name:        { color: '#fff', fontWeight: '600', fontSize: 16 },
  msgBtn:      { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center' },
  msgIcon:     { fontSize: 20 },
});
