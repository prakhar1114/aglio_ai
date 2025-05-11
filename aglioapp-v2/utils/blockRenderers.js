import React from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import DishCardBlock from '../components/blocks/DishCardBlock';
import QuickReplies from '../components/blocks/QuickReplies';
import StoryCarousal from '../components/blocks/StoryCarousal';
import ThumbnailRow from '../components/blocks/ThumbnailRow';
import ButtonGroup from '../components/blocks/ButtonGroup';

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
                  body: {
                    ...styles.botMessageText,
                    maxWidth: '100%',
                    marginHorizontal: 0,
                    paddingHorizontal: 5,
                  },
                  paragraph: {
                    fontSize: 16,
                    color: '#000',
                    marginVertical: 10,
                    marginHorizontal: 5,
                  },
                  text: {
                    fontSize: 16,
                    color: '#000',
                  },
                  heading1: {
                    fontSize: 26,
                    fontWeight: 'bold',
                    color: '#22223b',
                    marginTop: 20,
                    marginBottom: 8,
                  },
                  heading2: {
                    fontSize: 22,
                    fontWeight: 'bold',
                    color: '#22223b',
                    marginTop: 18,
                    marginBottom: 7,
                  },
                  heading3: {
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#22223b',
                    marginTop: 16,
                    marginBottom: 6,
                  },
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
          case 'story_carousal':
            return <StoryCarousal key={idx} stories={block.options} title={block.title || "Featured Stories"} />;
          case 'thumbnail_row':
            return <ThumbnailRow key={idx} options={block.options} title={block.title || "Your Previous Orders"} />;
          case 'button_group':
            return <ButtonGroup key={idx} options={block.options} title={block.title || "Actions"} />;
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
