<script lang="ts">
    const ratio = .7;
    export const cells = $state([
        { value: { id: 1, text: "Hallo" }, stamped: Math.random() > ratio, },
        { value: { id: 2, text: "Werte" }, stamped: Math.random() > ratio, },
        { value: { id: 3, text: "Hallo" }, stamped: Math.random() > ratio, },
        { value: { id: 4, text: "Random" }, stamped: Math.random() > ratio, },
        { value: { id: 5, text: "Werte" }, stamped: Math.random() > ratio, },
        { value: { id: 6, text: "Hallo" }, stamped: Math.random() > ratio, },
        { value: { id: 7, text: "Random" }, stamped: Math.random() > ratio, },
        { value: { id: 8, text: "Werte" }, stamped: Math.random() > ratio, },
        { value: { id: 9, text: "Hallo" }, stamped: Math.random() > ratio, },
        { value: { id: 10, text: "Welt" }, stamped: Math.random() > ratio, },
        { value: { id: 11, text: "Random" }, stamped: Math.random() > ratio, },
        { value: { id: 12, text: "Welt" }, stamped: Math.random() > ratio, },
        { value: { id: 13, text: "Random" }, stamped: Math.random() > ratio, },
        { value: { id: 14, text: "Welt" }, stamped: Math.random() > ratio, },
        { value: { id: 15, text: "Welt" }, stamped: Math.random() > ratio, },
        { value: { id: 16, text: "Werte" }, stamped: Math.random() > ratio, },
        { value: { id: 17, text: "Welt" }, stamped: Math.random() > ratio, },
        { value: { id: 18, text: "Welt" }, stamped: Math.random() > ratio, },
        { value: { id: 19, text: "Random" }, stamped: Math.random() > ratio, },
        { value: { id: 20, text: "Werte" }, stamped: Math.random() > ratio, },
        { value: { id: 21, text: "Welt" }, stamped: Math.random() > ratio, },
        { value: { id: 22, text: "Welt" }, stamped: Math.random() > ratio, },
        { value: { id: 23, text: "Random" }, stamped: Math.random() > ratio, },
        { value: { id: 24, text: "Welt" }, stamped: Math.random() > ratio, },
        { value: { id: 25, text: "Welt" }, stamped: Math.random() > ratio, },
    ])

    let { type = 'full' } = $props();
</script>
{#if type === 'full'}
<h1>Card #30</h1>
{/if}
<div class="card" class:preview={type === 'preview'}>
    {#each cells as cell }
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="cell" class:stamped={ cell.stamped } onclick={ () => { console.log(cell.stamped); cell.stamped = !cell.stamped} }>
            {#if type === 'full'}
                <span class="id">{ cell.value.id }</span>
                <span class="text">{ cell.value.text }</span>
            {/if}
        </div>
    {/each}
</div>

<style>
    h1 {
        text-align: center;
    }

    .card {
        border-radius: 1em;
        background-color: #f3f3f3;
        width: 500px;
        height: 500px;
        display: grid;
        padding: .5em;
        grid-template-columns: auto auto auto auto auto;
        gap: 1em;
        &.preview {
            width: 100%;
            height: 100%;
            padding: 1px;
            gap: 1px;
            border-radius: 2px;

            & .cell.stamped {
                background-color: rgba(119,51,102,1);
                outline: none;
            }
        }

        & .cell {
            background-color: #fefefe;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            
            border-radius: 1em;
            cursor: pointer;
            box-sizing: border-box;
            
            &.stamped {
                outline: 5px solid rgba(119,51,102,1);
            }

            & .id {
                opacity: .3;
                font-size: .8rem;
            }
            
            & .text {
                opacity: 1;
                font-size: .8rem;
            }
        }
    }
</style>