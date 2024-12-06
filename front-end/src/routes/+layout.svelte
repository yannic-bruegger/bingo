<script>
	import Player from "$lib/components/player.svelte";

</script>
<div class="layout">
    <main>
        <slot></slot>
    </main>
    <aside>
        <h1>Players</h1>
        <Player name="Vannioc"></Player>
        <Player name="Uwe"></Player>
        <Player name="Simons"></Player>
        <Player name="Simons"></Player>
        <Player name="Simons"></Player>
    </aside>
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
        align-items: center;
        flex-grow: 0;
    }
    aside {
        display: flex;
        flex-direction: column;
        gap: 1em;
    }
</style>
