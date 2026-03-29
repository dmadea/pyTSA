<script module>

    import type { HTMLButtonAttributes } from 'svelte/elements';

    export interface CloseButtonProps extends HTMLButtonAttributes {
        size?: string,
    }

</script>


<script lang="ts">

    let { size = "0.5em", ...props }: CloseButtonProps = $props()

</script>

<button class="btn-close {props.class}" aria-label="Close" {...props} style="width: {size}; height: {size}"></button>

<style>
    @import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
</style>