<script module>
    export interface TabItem {
        label: string,
        id: string | number,
        component: Component
    }
</script>

<script lang='ts'>
    import type { Component } from "svelte";

    interface Props {
        items: TabItem[],
        selectedID?: string | number,
        onSelect?: (key: number | string) => void,
        onClose?: (key: number | string) => void,
        onNewTabClicked?: () => void,
    }

    let {items, selectedID, onSelect, onClose, onNewTabClicked}: Props = $props();
    let _selectedID_internal_state = $state<number | string>(0);
    let _selectedID = $derived<number | string>(selectedID ?? _selectedID_internal_state)

    function _onSelect(id: string | number) {
        if (onSelect) {
            onSelect(id);
            return;
        }
        _selectedID_internal_state = id;
    }

</script>


<div>
    <ul>
        {#each items as item}
            <li class:active={_selectedID === item.id} >
                <button onclick={() => _onSelect(item.id)} class="tabbutton">{item.label} </button>
                <button onclick={() => {if (onClose) onClose(item.id)}} class='closebutton'>&times;</button>
            </li>
        {/each}
        <li>
            <button class="tabbutton plusbutton" onclick={() => {if (onNewTabClicked) onNewTabClicked()}}>+</button>
        </li>
    </ul>
    {#each items as item}
        {#if _selectedID == item.id}
        <div class="box">
            <item.component />
        </div>
        {/if}
    {/each}
</div>

<style>
    .box {
        margin-bottom: 10px;
        padding: 10px;
        border: 1px solid #dee2e6;
        border-radius: 0 0 .5rem .5rem;
        border-top: 0;
    }
    ul {
        display: flex;
        flex-wrap: wrap;
        padding-left: 0;
        margin-bottom: 0;
        list-style: none;
        border-bottom: 1px solid #dee2e6;
    }
    li {
        margin-bottom: -1px;
        position: relative;
    }

    button {
        border: 1px solid transparent;
        background-color: white;
        /* border-top-left-radius: 0.25rem; */
        /* border-top-right-radius: 0.25rem; */
        display: block;
        padding: 0.4rem 0.6rem;
        cursor: pointer;
        padding-right: 18px;
    }

    .closebutton {
        position: absolute;
        padding: 0;
        padding-bottom: 14px;
        bottom: 0;
        right: 0;
        margin: 0;
        width: 13px;
        height: 11px;
        transform: translate(-30%, -60%);
        border: none;
        border-radius: 20%;
        display: none;
        color: #000
    }

    .plusbutton {
        padding: 0.4rem 0.6rem;
    }

    .closebutton:hover {
        background-color: #ededed;
        /* border: 1px solid; */
        color: #f00
    }

    button:hover {
        border-color: #e9ecef #e9ecef #dee2e6;
    }

    li.active .tabbutton {
        color: #2600ff;
        background-color: #fff;
        border-color: #dee2e6 #dee2e6 #fff;
    }

    li:hover .closebutton {
        display: block
    }


</style>
