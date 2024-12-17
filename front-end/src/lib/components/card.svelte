<script lang="ts">
    const ratio = .7;
    export const cells = $state([])

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