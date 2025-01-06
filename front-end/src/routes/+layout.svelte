<script>
	import { getGameState, players, session } from '$lib/store.svelte';
	import '../app.css';
    let { children } = $props();
</script>

<div class="h-full flex flex-col">
    {@render children()}
    <details>
        <summary>Debug</summary>
        <div>
            Players: {JSON.stringify(players)}
        </div>
        <div>
            State: {getGameState()}
        </div>
        <div>
            Session: {session.id}
        </div>
        <div>
            Name: {session.username}
        </div>
    </details>
</div>

<style>
    details {
        font-family: monospace;
        background-color: #e5e9ed;
        padding: 1em;
    }
</style>