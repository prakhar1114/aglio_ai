import os
import re
import subprocess
import time

VERSIONS_DIR = "alembic/versions"
PREFIX_LENGTH = 3  # 3 digits: 000, 001, ...
MESSAGE = input("Migration message: ").strip().replace(" ", "_")

# 1. List existing migrations
existing = [
    f for f in os.listdir(VERSIONS_DIR)
    if re.match(r"\d{3}_.*\.py", f)
]

# 2. Determine next revision number
if not existing:
    next_num = 0
    down_revision = None
else:
    existing.sort()
    last = existing[-1]
    last_num = int(last.split("_")[0])
    next_num = last_num + 1
    
    # Find the down_revision from the last migration file
    down_revision = None
    with open(os.path.join(VERSIONS_DIR, last), "r") as f:
        for line in f:
            if line.startswith("revision: str ="):
                # Extract the revision ID from: revision: str = 'some_id'
                match = re.search(r"revision: str = ['\"]([^'\"]+)['\"]", line)
                if match:
                    down_revision = match.group(1)
                break

# 3. Format new revision ID
new_rev = str(next_num).zfill(PREFIX_LENGTH)

# 4. Generate a temp migration file (let Alembic fill the structure)
before_files = set(os.listdir(VERSIONS_DIR))
result = subprocess.run(
    ["alembic", "revision", "--autogenerate", "-m", MESSAGE],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    universal_newlines=True
)

if result.returncode != 0:
    print("❌ Failed to generate migration file.")
    print(result.stderr)
    exit(1)

# 5. Find the created file
time.sleep(0.5)

# 6. Capture list of files AFTER and find the new file
after_files = set(os.listdir(VERSIONS_DIR))
new_files = after_files - before_files

if not new_files:
    print("❌ Could not detect generated migration file.")
    print(result.stderr)
    exit(1)

# Get the new file (there should be exactly one)
orig_filename = next(iter(new_files))
orig_path = os.path.join(VERSIONS_DIR, orig_filename)
new_name = f"{new_rev}_{MESSAGE}.py"
new_path = os.path.join(VERSIONS_DIR, new_name)

# 7. Replace revision + down_revision inside the file
with open(orig_path, "r") as f:
    content = f.read()

content = re.sub(r"revision: str = ['\"].*['\"]", f"revision: str = '{new_rev}'", content)
if down_revision:
    content = re.sub(r"down_revision: Union\[str, Sequence\[str\], None\] = .*", f"down_revision: Union[str, Sequence[str], None] = '{down_revision}'", content)
else:
    content = re.sub(r"down_revision: Union\[str, Sequence\[str\], None\] = .*", "down_revision: Union[str, Sequence[str], None] = None", content)

with open(new_path, "w") as f:
    f.write(content)

# Remove the original file if it's different from the new one
if orig_path != new_path:
    os.remove(orig_path)

print(f"✅ Created: {new_path}")