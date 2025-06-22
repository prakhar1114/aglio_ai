import random

# List of friendly animal names for member nicknames
ANIMAL_NAMES = [
    "Otter", "Penguin", "Dolphin", "Panda", "Koala", "Tiger", "Lion", "Bear",
    "Fox", "Wolf", "Eagle", "Hawk", "Owl", "Robin", "Swan", "Deer",
    "Rabbit", "Squirrel", "Hamster", "Turtle", "Seal", "Whale", "Shark",
    "Octopus", "Lobster", "Butterfly", "Bee", "Dragonfly", "Ladybug",
    "Cat", "Dog", "Horse", "Zebra", "Giraffe", "Elephant", "Rhino",
    "Hippo", "Monkey", "Gorilla", "Cheetah", "Leopard", "Jaguar",
    "Lynx", "Cougar", "Bobcat", "Wolverine", "Badger", "Raccoon",
    "Skunk", "Opossum", "Beaver", "Chipmunk", "Mole", "Hedgehog",
    "Ferret", "Mink", "Weasel", "Stoat", "Ermine", "Porcupine"
]

def generate_nickname() -> str:
    """
    Generate a random animal nickname for a new member
    
    Returns:
        Random animal name string
    """
    return random.choice(ANIMAL_NAMES) 