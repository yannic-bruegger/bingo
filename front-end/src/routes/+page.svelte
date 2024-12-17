<script lang="ts">
	import * as InputOTP from '$lib/components/ui/input-otp/index';
	import * as Card from '$lib/components/ui/card/index';
	import { Input } from '$lib/components/ui/input/index';
	import { Button } from '$lib/components/ui/button/index';
	import { Label } from '$lib/components/ui/label/index';
	import { goto } from '$app/navigation';

	import { webSocket } from '$lib/store.svelte';
	import Header from '../stories/Header.svelte';
	let code = '';
	let username = '';

    const pinSize = 6;

	function joinGame(sessionCode: string) {
		webSocket.send(
			JSON.stringify({
				session: sessionCode,
				event: 'join',
				name: username
			})
		);
		webSocket.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.type === 'success') goto(`sessions/${sessionCode}`);
		};
	}

	function createNewGame() {
		webSocket.send(
			JSON.stringify({
				createsession: '',
				name: username
			})
		);

		webSocket.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.sessionId !== undefined) {
				const sessionId = data.sessionId;
				goto(`sessions/${sessionId}`);
			}
		};
	}

	function checkCode() {
		console.log(code);
		if (code.length === pinSize) joinGame(code);
	}
</script>

<div class="h-full flex items-center justify-center bg-slate-100">
	<main>
		<Card.Root>
			<Card.Header>
				<h1>B!NGO</h1>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
                <div class="flex w-full max-w-sm flex-col gap-1.5 mb-4">
                    <Label for="username">Username</Label>
                    <Input type="text" id="username" bind:value={username} /><br />
                  </div>
                  <div class="flex flex-row items-center w-full">
					<hr class="flex-grow-0 w-full"/>
					<p class="flex-grow-1 mx-4 text-sm text-nowrap">Join via game code</p>
					<hr class="flex-grow-0 w-full"/>
				</div>
				<InputOTP.Root maxlength={pinSize} bind:value={code} onkeypress={checkCode} class="w-full flex justify-center">
					{#snippet children({ cells })}
						<InputOTP.Group>
							{#each cells.slice(0, pinSize) as cell}
								<InputOTP.Slot {cell} />
							{/each}
						</InputOTP.Group>
					{/snippet}
				</InputOTP.Root>
				<div class="flex flex-row items-center w-full">
					<hr class="flex-grow-0 w-full"/>
					<p class="flex-grow-1 mx-4 text-sm text-nowrap">or</p>
					<hr class="flex-grow-0 w-full"/>
				</div>
				<Button onclick={createNewGame} class="w-full">Create a new game</Button>
				<br />
			</Card.Content>
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
