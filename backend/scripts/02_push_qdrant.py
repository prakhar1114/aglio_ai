# scripts/02_push_qdrant.py
import qdrant_client, pandas as pd, numpy as np
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from config import root_dir

restaurant_name = "chianti"
processed_data_json = root_dir / "processed" / f"{restaurant_name}_menu_with_vec.pkl"
df = pd.read_pickle(processed_data_json)

client = qdrant_client.QdrantClient("localhost", port=6333)  # local
client.recreate_collection(
    collection_name=f"{restaurant_name}_dishes",
    vectors_config=qdrant_client.http.models.VectorParams(
        size=1280, distance="Cosine"
    )
)
client.upload_collection(
    collection_name=f"{restaurant_name}_dishes",
    vectors=df["vector"].tolist(),
    payload=df.drop(columns=["vector"]).to_dict(orient="records"),
    ids=df["id"].tolist()
)
print("✅ Vectors uploaded")