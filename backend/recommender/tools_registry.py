openai_tools = [

    ## -----------------------------------------------------------
    ##  1. search_menu
    ## -----------------------------------------------------------
    {
        "type": "function",
        "name": "search_menu",
        "description": (
            "Semantic search across dish name and description. "
            "Use when the user asks for a specific dish, ingredient, "
            "or free‑text query like 'pesto pasta'. Returns name, ids, descriptions and category of the dishes"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search phrase"},
                "limit": {"type": "integer"}
            },
            "required": ["query"],
            "additionalProperties": False
        }
    },

    ## 2. get_chefs_picks
    {
        "type": "function",
        "name": "get_chefs_picks",
        "description": (
            "Returns filtered chef‑recommended dishes (and bestsellers as fallback). "
            "Returns names, ids, descriptions and category of the dishes"
        ),
        "parameters": {
            "type": "object",
            "properties": {}
        }
    },
    # ## 3. get_category_items
    # {
    #     "type": "function",
    #     "name": "get_category_items",
    #     "description": "Fetch dishes from a specific category (e.g., 'Dessert', 'Pasta').",
    #     "parameters": {
    #         "type": "object",
    #         "properties": {
    #             "category": {"type": "string"},
    #             "limit": {"type": "integer", "default": 10}
    #         },
    #         "required": ["category"],
    #         "additionalProperties": False
    #     },
    #     "strict": True
    # },
    ## 4. list_all_items
    {
        "type": "function",
        "name": "list_all_items",
        "description": (
            "Paginated list of ALL dishes that respect current filters. "
            "Call with page_size and page (number) when you need the full menu or when the user says "
            "'show more options'. Returns names, ids, descriptions and category of the dishes"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "page": {"type": "integer", "description": "Page number"},
                "page_size": {"type": "integer", "description": "Number of results per page"}
            },
            "additionalProperties": False
        }
    },

    ## 5. find_similar_items
    {
        "type": "function",
        "name": "find_similar_items",
        "description": (
            "Given a reference dish_id, return other dishes with similar "
            "flavour profile or ingredients. Returns names, ids, descriptions and category of the dishes"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "dish_id": {"type": "integer", "description": "Dish ID"},
                "limit": {"type": "integer", "description": "Number of results to return"}
            },
            "required": ["dish_id"],
            "additionalProperties": False
        }
    },

    ## 6. budget_friendly_options
    {
        "type": "function",
        "name": "budget_friendly_options",
        "description": (
            "Return dishes under a user‑specified price cap. "
            "Returns names, ids, descriptions and category of the dishes"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "priceCap": {"type": "number", "description": "Price cap"},
                "limit": {"type": "integer", "description": "Number of results to return"}
            },
            "required": ["priceCap"],
            "additionalProperties": False
        }
    },

    # ## 7. describe_dish
    # {
    #     "type": "function",
    #     "name": "describe_dish",
    #     "description": (
    #         "Return detailed description, allergens, spice level, etc. "
    #         "for one dish."
    #     ),
    #     "parameters": {
    #         "type": "object",
    #         "properties": {
    #             "dish_id": {"type": "integer"}
    #         },
    #         "required": ["dish_id"],
    #         "additionalProperties": False
    #     },
    #     "strict": True
    # },

    ## 8. get_cart_pairings
    {
        "type": "function",
        "name": "get_cart_pairings",
        "description": (
            "Suggest sides / drinks that pair well with items currently "
            "in the user's cart. Returns names, ids, descriptions and category of the dishes. "
            "If nothing is found, it means either the cart is empty or no pairings are available"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "cart": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "dish_id": {"type": "integer", "description": "Dish ID"},
                            "qty": {"type": "integer", "description": "Quantity"}
                        },
                        "required": ["dish_id"]
                    }
                },
                "limit": {"type": "integer", "description": "Number of results to return"}
            },
            "required": ["cart"],
            "additionalProperties": False
        }
    },

    # ## 9. validate_blocks  (internal guard)
    # {
    #     "type": "function",
    #     "name": "validate_blocks",
    #     "description": (
    #         "Returns true/False if the assistant's JSON response "
    #         "matches the agreed block schema."
    #     ),
    #     "parameters": {
    #         "type": "object",
    #         "properties": {
    #             "response": {"type": "object"}
    #         },
    #         "required": ["response"],
    #         "additionalProperties": False
    #     },
    #     "strict": True
    # }
]