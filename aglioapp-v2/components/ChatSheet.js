import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { GiftedChat } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import { renderBlockMessage } from '../utils/blockRenderers';
import { askAglio } from '../lib/socket';
import useStore from '../store';
import analytics from '../lib/analytics';

const ChatSheet = ({ open, onClose, height = '80%' }) => {
  const messages = useStore(state => state.messages);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!messages.length) return;
    if (messages[0].user._id === 'assistant') {
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [messages]);

  const handleSend = useCallback((newMessages = []) => {
    console.log('handleSend', newMessages);
    if (!newMessages.length) return;
    console.log('Sending message');
    const msg = newMessages[0];
    analytics.trackMessageSent(msg.text);
    useStore.getState().addMessage(msg);
    const { currentDish } = useStore.getState();
    askAglio({ text: msg.text, dishContext: currentDish ? { id: currentDish.id, name: currentDish.name } : undefined });
  }, []);

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { height }]}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Ask Aglio</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close chat" accessibilityRole="button">
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <GiftedChat
            messages={messages}
            onSend={handleSend}
            renderMessage={renderBlockMessage}
            user={{ _id: 1 }}
            isTyping={loading}
            placeholder="Type message..."
            alwaysShowSend
            scrollToBottom
            renderAvatar={null}
            keyboardShouldPersistTaps="handled"
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <Text>Thinking...</Text>
              </View>
            )}
            accessibilityLabel="Chat with Aglio AI"
            accessibilityLiveRegion="polite"
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerText: { fontSize: 18, fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});

export default ChatSheet;
