<script lang="ts">
	import * as InputOTP from '$lib/components/ui/input-otp/index';
    import { Button } from "$lib/components/ui/button/index";
    import { goto } from '$app/navigation';
    let code = '';
    
    function joinGame() {
        console.log("Connecting ...")
        const webSocket = new WebSocket('ws://localhost:8765');
        webSocket.onopen = (event) => {
            console.log("Joining ...")
            webSocket.send(JSON.stringify({
                session: code,
                event: "join",
                name: "Simon",
            }))
        }
        webSocket.onmessage = (event) => {
            const data = JSON.parse(event.data)
            if(data.type === "success") goto(`sessions/${code}`)
        }
    }

    function createNewGame() {
        console.log("Connecting ...")
        const webSocket = new WebSocket('ws://localhost:8765');
        
        webSocket.onopen = (event) => {
            console.log("Connected ...")
            webSocket.send(JSON.stringify({
                createsession: "",
                name: "Yannic",
            }))
        }

        webSocket.onmessage = (event) => {
            const data = JSON.parse(event.data)
            if(data.sessionId !== undefined) {
                const sessionId = data.sessionId
                goto(`sessions/${sessionId}`)
            }
        }
    }
</script>

<div class="layout">
	<main>
        Join a game via. Game Code<br>
		<InputOTP.Root maxlength={3} bind:value={code}>
            {#snippet children({ cells })}
              <InputOTP.Group>
                {#each cells.slice(0, 3) as cell}
                  <InputOTP.Slot {cell} />
                {/each}
              </InputOTP.Group>
            {/snippet}
          </InputOTP.Root>
          <Button onclick={joinGame}>Join</Button>
          {code}
          or
          <Button onclick={createNewGame}>Create a new game</Button>

	</main>
</div>

<style>
	.layout {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		background-color: #efefef;
		gap: 2em;
	}
	main {
		display: flex;
        flex-direction: column;
		align-items: center;
		flex-grow: 0;
	}
</style>
