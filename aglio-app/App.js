import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import axios from "axios";
import uuid from "react-native-uuid";

const API = "https://urchin-creative-supposedly.ngrok-free.app";
const sessionId = uuid.v4();

export default function App() {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchCard(extra={}) {
    setLoading(true);
    const { data } = await axios.get(`${API}/recommend`, { params: { session_id: sessionId, ...extra }});
    setCard(data);
    setLoading(false);
  }

  async function send(action){
    console.log("Sending feedback", { session_id: sessionId, id: card.id, action});
    await axios.post(`${API}/feedback`, { session_id: sessionId, id: card.id, action});
    if(action==="order"){ alert("Added to cart!"); }
    fetchCard();
  }

  useEffect(()=>{ fetchCard(); }, []);

  if(loading || !card) return <ActivityIndicator size="large" style={{flex:1}}/>;

  return (
    <View style={{flex:1, justifyContent:"center", alignItems:"center", padding:20}}>
      {card.image_path ?
        <Image source={{uri:`${API}/${card.image_path}`}} style={{width:250,height:180,borderRadius:16}}/>
        : <View style={{width:250,height:180,justifyContent:"center",alignItems:"center"}}><Text>No photo</Text></View>}
      <Text style={{fontSize:20,fontWeight:"600",marginTop:12}}>{card.name} • ₹{card.price}</Text>
      <Text style={{opacity:0.7, marginVertical:8, textAlign:"center"}}>{card.description}</Text>

      <View style={{flexDirection:"row",marginTop:16}}>
        <TouchableOpacity onPress={()=>send("dislike")} style={{padding:12,borderRadius:50,backgroundColor:"#eee",margin:6}}><Text>👎</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>send("like")}    style={{padding:12,borderRadius:50,backgroundColor:"#eee",margin:6}}><Text>👍</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>send("order")}   style={{padding:12,borderRadius:50,backgroundColor:"#eee",margin:6}}><Text>❤️</Text></TouchableOpacity>
      </View>
    </View>
  );
}