<script lang="ts">
	import { page } from '$app/stores';
	import Player from '$lib/components/player.svelte';
	import { session, webSocket } from '$lib/store.svelte';
	import * as Card from '$lib/components/ui/card/index';
	import { Button } from '$lib/components/ui/button';
	import { players } from '../../../lib/store.svelte';
	const id = $page.params.sessionId;

	function startGame() {
		webSocket.send(
			JSON.stringify({
				event: 'startGame',
				session: session.id,
				decksize: "5"
			})
		)
	}
</script>

<div class="flex h-full items-center justify-center bg-slate-100">
	<main>
		<Card.Root>
			<Card.Header>
				<h1>Game ID: <code class="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">{id}</code></h1>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				{#each players as player}
					<Player name={player} isPlayer={player === session.username}></Player>
				{/each}
			</Card.Content>
			<Card.Footer>
				<Button class="w-full" onclick={startGame}>Start</Button>
			</Card.Footer>
		</Card.Root>
	</main>
</div>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex-grow: 0;
	}
</style>
