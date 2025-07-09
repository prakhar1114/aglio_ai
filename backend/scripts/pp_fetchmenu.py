import json
import requests
config_path = '/Users/prakharjain/code/aglio_ai/backend/scripts/pp_staging.json'
output_dir = '/Users/prakharjain/code/aglio_ai/backend/scripts'
output_path = f'{output_dir}/menu.json'

with open(config_path, 'r') as file:
    data = json.load(file)

app_key = data['app-key']
app_secret = data['app-secret']
access_token = data['access-token']
rest_id = data['restID']

values = {
  "restID": rest_id
}

headers = {
  'Content-Type': 'application/json',
  'app-key': app_key,
  'app-secret': app_secret,
  'access-token': access_token
}

response = requests.post(data['apis']['fetchmenu'], json=values, headers=headers)

response.raise_for_status()

with open(output_path, 'w') as file:
    json.dump(response.json(), file, indent=4)