import React from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import DishCardBlock from '../components/blocks/DishCardBlock';
import QuickReplies from '../components/blocks/QuickReplies';

export function renderBlockMessage({ currentMessage }) {
  
  // Handle user messages (which have text property but no blocks)
  if (currentMessage.text && !currentMessage.blocks) {
    if (currentMessage.user._id === "assistant") {
      return (
        <Text style={styles.botMessageText}>{currentMessage.text}</Text>
      );
    } else {
      return (
        <View style={styles.userMessageContainer}>
          <Text style={styles.userMessageText}>{currentMessage.text}</Text>
        </View>
      );
    }
  }
  
  // Handle bot messages with blocks
  const blocks = currentMessage.blocks;
  if (!blocks) return null;
  console.log(blocks);

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'text':
            return (
              <Markdown 
                key={idx} 
                style={{
                  body: styles.botMessageText,
                  paragraph: {
                    fontSize: 16,
                    color: '#000',
                    marginVertical: 10,
                    marginHorizontal: 12,
                  },
                  text: {
                    fontSize: 16,
                    color: '#000',
                  }
                }}>
                {block.markdown}
              </Markdown>
            );
          case 'dish_card':
            return <DishCardBlock key={idx} {...block.payload} />;
          case 'dish_carousal':
            return (
              <FlatList
                key={`carousel-${idx}`}
                data={block.options}
                horizontal
                renderItem={({ item }) => <DishCardBlock {...item} />}
                keyExtractor={item => item.id.toString()}
              />
            );
          case 'quick_replies':
            return <QuickReplies key={idx} options={block.options} />;
          case 'order_summary':
            return (
              <Text key={idx} style={styles.text}>
                {JSON.stringify(block.payload)}
              </Text>
            );
          default:
            return (
              <Text key={idx} style={styles.text}>
                Unsupported content
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 5,
  },
  text: {
    fontSize: 16,
    marginBottom: 5,
  },
  userMessageContainer: {
    backgroundColor: '#e0e0e0',  // Gray box for user messages
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    marginHorizontal: 15,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  userMessageText: {
    fontSize: 16,
    color: '#000',
  },
  botMessageText: {
    fontSize: 16,
    color: '#000',
    marginVertical: 10,
    marginHorizontal: 15,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  }
});
