import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, Image, TouchableOpacity, ActivityIndicator, Switch, ScrollView } from "react-native";
import Slider from '@react-native-community/slider';
import axios from "axios";
import uuid from "react-native-uuid";

const API = "https://urchin-creative-supposedly.ngrok-free.app";
const sessionId = uuid.v4();

export default function App() {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);
  const [priceFilterEnabled, setPriceFilterEnabled] = useState(false);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [imageLoading, setImageLoading] = useState(true);
  const [history, setHistory] = useState({ likes: [], orders: [], dislikes: [] });
  const [view, setView] = useState('main');

  async function fetchCard(extra={}) {
    setLoading(true);
    const { data } = await axios.get(`${API}/recommend`, { params: { session_id: sessionId, ...extra }});
    setCard(data);
    setLoading(false);
  }

  async function send(action){
    await axios.post(`${API}/feedback`, { session_id: sessionId, id: card.id, action });
    if(action === "order") alert("Added to cart!");
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
  }, []);

  if (view === 'history') {
    return (
      <SafeAreaView style={{flex:1}}>
        <View style={{padding:20}}>
          <TouchableOpacity onPress={() => setView('main')} style={{marginBottom:10}}>
            <Text style={{color:'blue'}}>← Back</Text>
          </TouchableOpacity>
          <Text style={{fontSize:20,fontWeight:'600',textAlign:'center',marginBottom:12}}>
            Your Feedback History
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow:1,
              flexDirection:'row',
              justifyContent:'space-between',
              alignItems:'flex-start',
              paddingHorizontal:20
            }}
            style={{width:'100%'}}
          >
            {['likes','orders','dislikes'].map(col=>(
              <View key={col} style={{flex:1,alignItems:'center',paddingHorizontal:8}}>
                <Text style={{fontWeight:'bold',marginBottom:4}}>{col}</Text>
                {history[col].length>0 ? history[col].map(item=>(
                  <Image key={item.id} source={{uri:`${API}/${item.image_path}`}} style={{width:60,height:60,margin:2}}/>
                )) : <Text style={{fontStyle:'italic'}}>None</Text>}
              </View>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  if(loading || !card) return <ActivityIndicator size="large" style={{flex:1}}/>

  return (
    <SafeAreaView style={{flex:1}}>

      <View style={{flex:1, justifyContent:"flex-start", alignItems:"center", padding:20}}>
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

        <View style={{flexDirection:"row",marginTop:16}}>
          <TouchableOpacity onPress={()=>send("dislike")} style={{padding:12,borderRadius:50,backgroundColor:"#eee",margin:6}}><Text>👎</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>send("like")}    style={{padding:12,borderRadius:50,backgroundColor:"#eee",margin:6}}><Text>👍</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>send("order")}   style={{padding:12,borderRadius:50,backgroundColor:"#eee",margin:6}}><Text>❤️</Text></TouchableOpacity>
        </View>
        {/* Improved View History Button */}
        <TouchableOpacity
          onPress={() => setView('history')}
          style={{
            marginTop: 24,
            alignSelf: 'center',
            backgroundColor: '#e0e7ff',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 24,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b3b3b', marginRight: 6 }}>🕑</Text>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b3b3b' }}>View History</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}