import asyncio
import sys
import json
import base64
import os
from cmdop import AsyncCMDOPClient

async def bridge():
    if len(sys.argv) < 3:
        print(json.dumps({"type": "error", "message": "Usage: cmdop_bridge.py <api_key> <session_id>"}))
        return

    api_key = sys.argv[1]
    session_id = sys.argv[2]

    try:
        async with AsyncCMDOPClient.remote(api_key=api_key) as client:
            stream = client.terminal.stream()

            def on_output(data):
                # Data is bytes, encode to base64 for JSON transport
                payload = {
                    "type": "output",
                    "data": base64.b64encode(data).decode('utf-8')
                }
                print(json.dumps(payload), flush=True)

            def on_status(status_data):
                payload = {
                    "type": "status",
                    "status": status_data.new_status,
                    "reason": status_data.reason
                }
                print(json.dumps(payload), flush=True)

            def on_error(code, message, is_fatal):
                payload = {
                    "type": "error",
                    "code": code,
                    "message": message,
                    "is_fatal": is_fatal
                }
                print(json.dumps(payload), flush=True)

            stream.on_output(on_output)
            stream.on_status(on_status)
            stream.on_error(on_error)

            # Attach to existing session
            await stream.attach(session_id)

            # Task to read stdin and send to stream
            async def stdin_loop():
                loop = asyncio.get_event_loop()
                reader = asyncio.StreamReader()
                protocol = asyncio.StreamReaderProtocol(reader)
                await loop.connect_read_pipe(lambda: protocol, sys.stdin)

                while True:
                    line = await reader.readline()
                    if not line:
                        break
                    
                    try:
                        msg = json.loads(line.decode())
                        msg_type = msg.get("type")
                        if msg_type == "input":
                            data = base64.b64decode(msg.get("data", ""))
                            await stream.send_input(data)
                        elif msg_type == "resize":
                            await stream.send_resize(msg.get("cols", 80), msg.get("rows", 24))
                        elif msg_type == "signal":
                            await stream.send_signal(msg.get("signal", 2))
                    except Exception as e:
                        print(json.dumps({"type": "debug", "message": f"Stdin loop error: {str(e)}"}), flush=True)

            await stdin_loop()

    except Exception as e:
        print(json.dumps({"type": "error", "message": str(e)}))

if __name__ == "__main__":
    asyncio.run(bridge())
