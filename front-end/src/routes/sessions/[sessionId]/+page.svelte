<script lang="ts">
  import { page } from '$app/stores';
	import Player from '$lib/components/player.svelte';
	import { webSocket } from '$lib/store.svelte';
  import * as Card from '$lib/components/ui/card/index';
	import { Button } from '$lib/components/ui/button';
  const id = $page.params.sessionId

  const players: Array<Player> = $state([])

  webSocket.onmessage = (message) => {
    const data = JSON.parse(message.data)
    switch(data.type) {
      case "user_joined": 
        console.log(data)
        players.push(data.name)
        console.log(players)
        break;       
    }
  }
</script>

<div class="h-full flex items-center justify-center bg-slate-100">
	<main>
		<Card.Root>
			<Card.Header>
				<h1>Game ID: {id}</h1>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
        {#each players as player}
          <Player name={player}></Player>
        {/each}
			</Card.Content>
      <Card.Footer>
        <Button class="w-full">Start</Button>
      </Card.Footer>
		</Card.Root>
	</main>
</div>

<style>
	.layout {
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
