"""
ai.py  – High‑level orchestration layer for the Ask Aglio chatbot.

`generate_blocks(question, session_id)`:
    • Maintains OpenAI conversational context (storing the last response_id in Redis)
    • Lets the model call our backend “tools” (function‑calling)
    • Converts the result into FE‑ready `blocks` (validated)
"""

import os, json
import time
from types import NoneType
from loguru import logger
from typing import List, Dict, Any
from dotenv import load_dotenv

from openai import OpenAI
from redis import Redis

from config import rdb  # redis instance from your config
from .tools_registry import openai_tools
from . import SYSTEM_PROMPT, Blocks
from . import tools

load_dotenv()
client = OpenAI()                # assumes OPENAI_API_KEY env var


# ------------------------------------------------------------ #
#  Helpers
# ------------------------------------------------------------ #
_TOOL_MAP = {
    "search_menu": tools.search_menu,
    "get_chefs_picks": tools.get_chefs_picks,
    "list_all_items": tools.list_all_items,
    "find_similar_items": tools.find_similar_items,
    "budget_friendly_options": tools.budget_friendly_options,
    "get_cart_pairings": tools.get_cart_pairings,
}

RESP_KEY = lambda sid: f"resp:{sid}"   # redis key to store last response.id


# ------------------------------------------------------------ #
#  Public entry
# ------------------------------------------------------------ #
def generate_blocks(payload: Dict[str, Any], thread_id: str) -> Blocks:
    """
    Main entry used by the WebSocket handler.

    Parameters
    ----------
    payload : dict
        User context + question.
    thread_id : str
        Socket thread ID (maps to redis key storing last response.id).

    Returns
    -------
    blocks : Blocks
    """
    prev_id = rdb.get(RESP_KEY(thread_id))
    prev_id = prev_id.decode() if prev_id else None

    # data from payload
    question = payload.pop("text")
    filters = payload.pop("filters")
    cart = payload.pop("cart")
    more_context = payload

    msgs = []
    if prev_id is None:
        system_msg = {
            "role": "system",
            "content": SYSTEM_PROMPT,
        }
        msgs.append(system_msg)
    
    msg = {
        "role": "user",
        "content": question,
    }
    msgs.append(msg)

    counter = iter(range(0, 5))
    while True:
        logger.debug(f"iteration: {next(counter)}")
        t1 = time.time()
        response = client.responses.parse(
            model="gpt-4.1",
            input=msgs,
            previous_response_id=prev_id,
            tools=openai_tools,
            tool_choice="auto",
            text_format=Blocks,
            timeout=60,
        )
        logger.debug(f"Model Response took {time.time() - t1}")
        msgs = []
        # Persist context id for next turn
        prev_id = response.id
        rdb.set(RESP_KEY(thread_id), prev_id)

        # print(response.model_dump())

        check_tools_calls = any([output.type == "function_call" for output in response.output])

        # 2️⃣  If the model wants to call a function
        if check_tools_calls:
            for tool_call in response.output:
                fn_name   = tool_call.name
                fn_args   = json.loads(tool_call.arguments)
                call_id = tool_call.call_id
                logger.debug(f"Calling function {fn_name}")

                if fn_name not in _TOOL_MAP:
                    logger.error("Unknown tool call requested: %s", fn_name)
                    raise Exception("Unknown tool call requested: %s" % fn_name)

                # Call the local Python helper
                if fn_name in ["search_menu", "get_chefs_picks", "list_all_items", "find_similar_items", "budget_friendly_options", "get_cart_pairings"]:
                    fn_args["filters"] = filters

                if fn_name == "get_cart_pairings":
                    fn_args["cart"] = cart

                result = _TOOL_MAP[fn_name](**fn_args)

                msgs.append({"type": "function_call_output", "output": str(result), "call_id": call_id})
            continue
        else:
            # WRITE EXIT ROUTINE AND ENRICHMENT
            blocks = response.output_parsed
            break
    logger.debug(blocks.model_dump())
    return blocks