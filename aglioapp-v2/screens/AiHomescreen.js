import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  TextInput
} from 'react-native';
import { GiftedChat, InputToolbar, Send } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { renderBlockMessage } from '../utils/blockRenderers';
import { sendMessage } from '../lib/socket';
import useStore from '../store';
import analytics from '../lib/analytics';
import FloatingCartFab from '../components/FloatingCartFab';
import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';

const AiHomescreen = () => {
  const navigation = useNavigation();
  const messages = useStore(state => state.messages);
  const cart = useStore(state => state.cart);
  const [loading, setLoading] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarAnimation = useRef(new Animated.Value(0)).current;
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(44); // Initial height
  
  const screenWidth = Dimensions.get('window').width;
  const sidebarWidth = screenWidth * 0.8; // 80% of screen width

  // Handle when messages change to update loading state
  useEffect(() => {
    if (!messages.length) return;
    if (messages[0].user._id === 'assistant') {
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [messages]);

  // // Handle sending messages
  // const handleSend = useCallback((newMessages = []) => {
  //   if (!newMessages.length) return;
  //   const msg = newMessages[0];
  //   analytics.trackMessageSent(msg.text);
  //   useStore.getState().addMessage(msg);
  //   sendMessage({
  //     _id: Math.round(Math.random() * 1000000),
  //     text: msg.text,
  //     createdAt: new Date(),
  //     user: {
  //       _id: "user",
  //     }
  //   });
  // }, []);
  
  // Toggle or close sidebar
  const toggleSidebar = (forceClose = false) => {
  
    // If forceClose is true, always close the sidebar
    // Otherwise, toggle between open and closed
    const newVisibility = forceClose ? false : !sidebarVisible;
    const toValue = newVisibility ? 1 : 0;
  
  
    Animated.timing(sidebarAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  
    setSidebarVisible(newVisibility);
  };

  // // Calculate sidebar position based on animation value
  // const sidebarLeft = sidebarAnimation.interpolate({
  //   inputRange: [0, 1],
  //   outputRange: [-sidebarWidth, 0],
  // });
  
  // // Calculate overlay opacity based on animation value
  // const overlayOpacity = sidebarAnimation.interpolate({
  //   inputRange: [0, 1],
  //   outputRange: [0, 0.5],
  // });
  
  // Handle sending messages directly from custom input
  const handleSendPress = () => {
    if (!inputText.trim()) return;
    
    // Create a message object
    const newMessage = {
      _id: Math.round(Math.random() * 1000000),
      text: inputText.trim(),
      createdAt: new Date(),
      user: {
        _id: "user",
      }
    };
    
    // Track analytics
    analytics.trackMessageSent(newMessage.text);
    
    // Send via socket
    sendMessage(newMessage);
    
    // Clear input
    setInputText('');
  };
  
  // Handle recording
  const handleRecordPress = () => {
    // Implement voice recording functionality here
    console.log('Voice recording pressed');
  };
  
  // Custom input toolbar to match the design
  const customInputToolbar = props => {
    return (
      <View style={styles.inputToolbar}>
        <View style={styles.inputPrimary}>
          <View style={styles.composerContainer}>
            <TextInput
              style={[styles.textInput, { height: Math.max(44, inputHeight) }]}
              placeholder="Ask anything"
              placeholderTextColor="#9CA3AF"
              multiline={true}
              value={inputText}
              onChangeText={text => setInputText(text)}
              onContentSizeChange={(event) => {
                setInputHeight(event.nativeEvent.contentSize.height);
              }}
              onSubmitEditing={handleSendPress}
            />
          </View>
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.recordButton} onPress={handleRecordPress}>
              <Ionicons name="mic-outline" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sendContainer, !inputText.trim() && styles.sendDisabled]} 
              onPress={handleSendPress}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={24} color={inputText.trim() ? "#007AFF" : "#CCCCCC"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      
      {/* Header */}
      <Topbar 
        heading="AI Food Assistant" 
        onMenuPress={toggleSidebar} 
        buttonText="Home" 
        buttonPath="Home" 
      />
      
      {/* Sidebar */}
      <Sidebar 
        isVisible={sidebarVisible} 
        sidebarAnimation={sidebarAnimation} 
        toggleSidebar={toggleSidebar}
      />  
      
      {/* Chat Area */}
      <TouchableWithoutFeedback onPress={() => toggleSidebar(true)}>
        <View style={[styles.chatContainer, cart.length > 0 && { paddingBottom: 145 }]}>
          <MemoizedGiftedChat
            messages={messages}
            user={{ _id: 1 }}
            renderMessage={renderBlockMessage}
            isTyping={loading}
            minInputToolbarHeight={60}
            scrollToBottom
            renderAvatar={null}
            keyboardShouldPersistTaps="handled"
            renderInputToolbar={() => null}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <Text>Thinking...</Text>
              </View>
            )}
          />
        </View>
      </TouchableWithoutFeedback>
      
      {/* Custom Input Toolbar Fixed at Bottom */}
      <View style={[styles.fixedInputToolbarContainer, cart.length > 0 && styles.inputToolbarWithCart]}>
        {customInputToolbar()}
      </View>
      
      {/* Floating Cart FAB */}
      <FloatingCartFab />
    </SafeAreaView>
  );
};

// Memoized GiftedChat component that only re-renders when messages or loading changes
const MemoizedGiftedChat = memo(GiftedChat, (prevProps, nextProps) => {
  return (
    prevProps.messages === nextProps.messages &&
    prevProps.isTyping === nextProps.isTyping
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  chatContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 85, // Add padding at bottom to prevent messages from being hidden under the input toolbar
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
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
  },

  inputToolbar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 60,
  },
  inputPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  composerContainer: {
    flex: 1,
    marginRight: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 44,
  },
  sendContainer: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
  recordButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedInputToolbarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 10,
    zIndex: 100,
    paddingBottom: 10, // Add bottom padding for better visibility
  },
  inputToolbarWithCart: {
    bottom: 60, // Move up to make room for the FloatingCartFab
  },
});

export default AiHomescreen;
