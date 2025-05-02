import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, Image, TouchableOpacity, ActivityIndicator, Switch, ScrollView, Modal } from "react-native";
import Slider from '@react-native-community/slider';
import axios from "axios";
import uuid from "react-native-uuid";
import OrderCelebration from "./OrderCelebration";

const API = "https://urchin-creative-supposedly.ngrok-free.app";

export default function App() {
  const [sessionId, setSessionId] = useState(uuid.v4());
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);
  const [priceFilterEnabled, setPriceFilterEnabled] = useState(false);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [imageLoading, setImageLoading] = useState(true);
  const [history, setHistory] = useState({ maybe: [], skip: [] });
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [reviewMode, setReviewMode] = useState(false);

  const toggleSelect = id => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const startOver = () => {
    setReviewMode(false);
    setSessionId(uuid.v4());
    setVegOnly(false);
    setPriceFilterEnabled(false);
    setMaxPrice(1000);
    setCard(null);
    setSelectedItems([]);
    setHistory({ maybe: [], skip: [] });
    applyFilters();
    fetchHistory();
  };

  async function fetchCard(extra={}) {
    setLoading(true);
    const { data } = await axios.get(`${API}/recommend`, { params: { session_id: sessionId, ...extra }});
    setCard(data);
    setLoading(false);
  }

  async function send(action){
    await axios.post(`${API}/feedback`, { session_id: sessionId, id: card.id, action });
    applyFilters();
    fetchHistory();
  }

  function applyFilters() {
    const extraParams = {};
    if (vegOnly) extraParams.is_veg = true;
    if (priceFilterEnabled) extraParams.price_cap = maxPrice;
    fetchCard(extraParams);
  }

  async function fetchHistory() {
    const { data } = await axios.get(`${API}/history`, { params: { session_id: sessionId } });
    setHistory(data);
  }

  useEffect(() => {
    applyFilters();
    fetchHistory();
  }, [sessionId]);

  if (reviewMode) {
    const orderItems = history.maybe.filter(item => selectedItems.includes(item.id));
    return <OrderCelebration orderItems={orderItems} onStartOver={startOver} />;
  }

  if(loading || !card) return <ActivityIndicator size="large" style={{flex:1}}/>

  return (
    <SafeAreaView style={{flex:1}}>
      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={{flex:1, backgroundColor:'#fff'}}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16}}>
            <Text style={{fontSize:18, fontWeight:'bold'}}>Shortlist ({history.maybe.length})</Text>
            <TouchableOpacity onPress={()=>setModalVisible(false)} style={{
              backgroundColor: '#e0e7ff',
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
            }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#3b3b3b' }}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={{fontSize:16, fontWeight:'500', marginHorizontal:16, marginBottom:10}}>Choose dishes to add to your order</Text>
          <ScrollView style={{padding:10}}>
            {history.maybe.length>0 ? history.maybe.map(item=>(
              <TouchableOpacity key={item.id} onPress={() => toggleSelect(item.id)} style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
                backgroundColor: selectedItems.includes(item.id) ? '#e6f9e6' : '#fff',
                borderWidth: 1,
                borderColor: '#e0e7ff',
                borderRadius: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 2,
                padding: 8,
              }}>
                <Image source={{uri:`${API}/${item.image_path}`}} style={{width:60, height:60, borderRadius:8, marginRight:10}}/>
                <View style={{flex:1}}>
                  <Text style={{fontSize:16, fontWeight:'500'}}>{item.name}</Text>
                  <Text style={{color:'#888'}} numberOfLines={2}>{item.description}</Text>
                  <Text style={{marginTop:4, fontWeight:'600'}}>₹{item.price}</Text>
                </View>
              </TouchableOpacity>
            )) : <Text style={{textAlign:'center', marginTop:20}}>No items</Text>}
          </ScrollView>
          <View style={{padding:16, borderTopWidth:1, borderColor:'#eee'}}>
            <TouchableOpacity onPress={() => { setModalVisible(false); setReviewMode(true); }} disabled={selectedItems.length === 0} style={{
              backgroundColor: selectedItems.length === 0 ? '#ccc' : '#4CAF50',
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
            }}>
              <Text style={{
                color: selectedItems.length === 0 ? '#888' : '#fff',
                fontSize: 16,
                fontWeight: 'bold',
              }}>
                Place Order (₹{selectedItems.reduce((sum, id) => {
                  const item = history.maybe.find(i => i.id === id);
                  return sum + (item ? Number(item.price) : 0);
                }, 0)})
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
      <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: "flex-start", alignItems: "center", padding: 20}}>
        <View style={{width:"100%", marginBottom:20}}>
          <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
            <Text>Veg Only</Text>
            <Switch value={vegOnly} onValueChange={setVegOnly} />
          </View>
          <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
            <Text>Price Filter</Text>
            <Switch value={priceFilterEnabled} onValueChange={setPriceFilterEnabled} />
          </View>
          {priceFilterEnabled && (
            <View style={{marginTop:10}}>
              <Text>Max Price: ₹{maxPrice}</Text>
              <Slider minimumValue={0} maximumValue={1000} step={100} value={maxPrice} onValueChange={setMaxPrice} />
            </View>
          )}
        </View>
        {card.image_path ?
          <View style={{width:300, height:220, borderRadius:16, overflow:"hidden", justifyContent:"center", alignItems:"center", backgroundColor:"#eee"}}>
            {imageLoading && <ActivityIndicator style={{position:"absolute"}} />}
            <Image source={{uri:`${API}/${card.image_path}`}} style={{width:"100%", height:"100%"}} onLoadStart={()=>setImageLoading(true)} onLoadEnd={()=>setImageLoading(false)}/>
          </View>
          : <View style={{width:300,height:220,justifyContent:"center",alignItems:"center"}}><Text>No photo</Text></View>}
        <Text style={{fontSize:20,fontWeight:"600",marginTop:12}}>{card.name} • ₹{card.price}</Text>
        <Text style={{opacity:0.7, marginVertical:8, textAlign:"center"}}>{card.description}</Text>
        <View style={{ flexDirection: "row", marginTop: 16 }}>
        <TouchableOpacity
            onPress={() => send("skip")}
            style={{
              flex: 1,
              paddingVertical: 16,
              backgroundColor: "#F44336",
              margin: 6,
              borderRadius: 8,
              alignItems: "center"
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
              Ignore
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => send("maybe")}
            style={{
              flex: 1,
              paddingVertical: 16,
              backgroundColor: "#4CAF50",
              margin: 6,
              borderRadius: 8,
              alignItems: "center"
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
              Shortlist
            </Text>
          </TouchableOpacity>
        </View>
        {/* Shortlist Section */}
        <View style={{
          backgroundColor: '#fff',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#e0e7ff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.07,
          shadowRadius: 8,
          marginVertical: 20,
          paddingVertical: 16,
          paddingHorizontal: 12,
          alignItems: 'center',
          width: '100%',
        }}>
          <Text style={{fontSize:18, fontWeight:'600', marginBottom: 10}}>Select Meal from the Shortlist</Text>
          {history.maybe.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10, width: '100%'}}>
              {history.maybe.map(item => (
                <TouchableOpacity key={item.id} onPress={() => setModalVisible(true)} style={{marginRight:8}}>
                  {item.image_path ? (
                    <Image
                      source={{ uri: `${API}/${item.image_path}` }}
                      style={{ width: 80, height: 80, borderRadius: 8 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 8,
                        backgroundColor: "#eee",
                        justifyContent: "center",
                        alignItems: "center"
                      }}
                    >
                      <Text style={{ color: "#aaa", fontSize: 32 }}>🖼️</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={{color:'#888', marginBottom:10}}>No items shortlisted yet.</Text>
          )}
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            disabled={history.maybe.length === 0}
            style={{
              marginTop: 4,
              alignSelf: 'center',
              backgroundColor: history.maybe.length === 0 ? '#ccc' : '#e0e7ff',
              paddingVertical: 10,
              paddingHorizontal: 20,
              borderRadius: 20,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              opacity: history.maybe.length === 0 ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: history.maybe.length === 0 ? '#888' : '#3b3b3b' }}>
              View Shortlist ({history.maybe.length})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}