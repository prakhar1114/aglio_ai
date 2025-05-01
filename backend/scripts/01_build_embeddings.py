import pandas as pd, numpy as np, torch, clip, pathlib, qdrant_client
from sentence_transformers import SentenceTransformer
from PIL import Image
import json
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from config import root_dir


mps = torch.backends.mps.is_available()
device = "mps" if mps else "cpu"

txt_model = SentenceTransformer("all-mpnet-base-v2", device=device)
clip_model, preprocess = clip.load("ViT-B/32", device="cpu")

restaurant_name = "chianti"
full_data_json = root_dir / "processed" / f"{restaurant_name}.json"
processed_data_json = root_dir / "processed" / f"{restaurant_name}_menu_with_vec.pkl"
df = pd.read_json(full_data_json)
vecs = []

for _, row in df.iterrows():
    text = f"{row['name']} {row['category']} {row['description']}"
    t_vec = txt_model.encode(text)
    try:
        image_path = root_dir / row['image_path']
        if image_path.exists():
            img = preprocess(Image.open(image_path)).unsqueeze(0)
            with torch.no_grad():
                i_vec = clip_model.encode_image(img)[0].cpu().numpy()
        else:
            i_vec = np.zeros(512)
    except:
        i_vec = np.zeros(512)

    vecs.append(np.concatenate([t_vec, i_vec]))
df["vector"] = vecs
df.to_pickle(processed_data_json)