import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GiftedChat } from 'react-native-gifted-chat';
import { renderBlockMessage } from '../utils/blockRenderers';
import useStore from '../store';
import analytics from '../lib/analytics';
import { sendMessage } from '../lib/socket';

const InlineChatSheet = ({ visible, onClose }) => {
  const messages = useStore(state => state.messages);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

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
    sendMessage({
        _id: Math.round(Math.random() * 1000000),
        text: msg.text,
        createdAt: new Date(),
        user: {
          _id: "user", // User's ID
        }
      });
  }, []);
  
  // Fixed height for the chat component - enough for 2 messages + input
  const chatHeight = 400;

  if (!visible) return null;

  return (
    <View style={[styles.sheet, { height: chatHeight }]}>
      <GiftedChat
        ref={chatRef}
        messages={messages.slice(0, 2)}
        onSend={handleSend}
        renderMessage={renderBlockMessage}
        timeTextStyle={{ right: { display: 'none' }, left: { display: 'none' } }}
        user={{ _id: 1 }}
        isTyping={loading}
        placeholder="Ask about this dish..."
        alwaysShowSend
        scrollToBottom
        renderAvatar={null}
        keyboardShouldPersistTaps="handled"
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <Text>Thinking...</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    overflow: 'hidden',
    marginTop: 10,
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 10 
  },
  textInput: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    fontSize: 14,
    paddingTop: 8,
    paddingBottom: 8,
    maxHeight: 44,
    flex: 1,
  },
  inputToolbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});

export default InlineChatSheet;
