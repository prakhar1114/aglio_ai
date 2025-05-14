Running qdrant:
```bash
docker run -d --name qdrant -p 6333:6333 -v $(pwd)/qdrant_data:/qdrant/storage qdrant/qdrant
```

Running backend:
```bash
conda activate aglio_ai
python -m backend.main
```

Running frontend:
```bash
cd aglio-app
npm start
```
Ngrok tunnel:
```bash
ngrok http --url=urchin-creative-supposedly.ngrok-free.app 8005
```

First setup docker
Setup redis container
Run scripts
then run main.py