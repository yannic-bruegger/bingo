<script lang="ts">
	import * as InputOTP from '$lib/components/ui/input-otp/index';
	import * as Card from '$lib/components/ui/card/index';
	import { Input } from '$lib/components/ui/input/index';
	import { Button } from '$lib/components/ui/button/index';
	import { Label } from '$lib/components/ui/label/index';

	import { session, webSocket } from '$lib/store.svelte';

	const pinSize = 6;
	let isCreatingGame = false;

	function checkCode() {
		if (session.id.length !== pinSize) return;
		joinGame(session.id);
	}

	function joinGame(sessionCode: string) {
		if(isCreatingGame) return;
		webSocket.send(
			JSON.stringify({
				session: sessionCode,
				event: 'join',
				name: session.username
			})
		);
	}

	function createNewGame() {
		isCreatingGame = true;
		webSocket.send(
			JSON.stringify({
				createsession: '',
				name: session.username
			})
		);
	}

</script>

<div class="flex h-full items-center justify-center bg-slate-100">
	<main>
		<Card.Root>
			<Card.Header>
				<h1>B!NGO</h1>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<div class="mb-4 flex w-full max-w-sm flex-col gap-1.5">
					<Label for="username">Username</Label>
					<Input type="text" id="username" bind:value={session.username} required/><br />
				</div>
				<div class="flex w-full flex-row items-center">
					<hr class="w-full flex-grow-0" />
					<p class="flex-grow-1 mx-4 text-nowrap text-sm">Join via game code</p>
					<hr class="w-full flex-grow-0" />
				</div>
				<InputOTP.Root
					maxlength={pinSize}
					onComplete={checkCode}
					bind:value={session.id}
					class="flex w-full justify-center"
				>
					{#snippet children({ cells })}
						<InputOTP.Group>
							{#each cells.slice(0, pinSize) as cell}
								<InputOTP.Slot {cell} />
							{/each}
						</InputOTP.Group>
					{/snippet}
				</InputOTP.Root>
				<div class="flex w-full flex-row items-center">
					<hr class="w-full flex-grow-0" />
					<p class="flex-grow-1 mx-4 text-nowrap text-sm">or</p>
					<hr class="w-full flex-grow-0" />
				</div>
				<Button onclick={createNewGame} class="w-full">Create a new game</Button>
				<br />
			</Card.Content>
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
