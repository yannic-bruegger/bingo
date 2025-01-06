<script lang="ts">
	import Card from "./card.svelte";

    let { name, isPlayer } = $props();
</script>

<div class="player">
    <div class="preview">
        <Card type="preview"></Card>
    </div>
    <div class="details">
        { name } {#if isPlayer} (you) {/if}
    </div>
</div>

<style>
    .player {
        background-color: #fefefe;
        display: flex;
        border-radius: 1em;
        padding: 1em;
        align-items: center;
        gap: 1em;
        min-width: 20em;

        & .preview {
            width: 3em;
            height: 3em;
        }
    }
</style>