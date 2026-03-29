<script module>

    import type { HTMLInputAttributes } from 'svelte/elements';

    export interface InputProps extends HTMLInputAttributes {
        isValidInput?: (value: string, parsedNumber: number) => boolean,
        value?: number
    }

</script>


<script lang="ts">

    let { isValidInput = (v, n) => true, value = $bindable<number>(Number.NaN) , ...props }: InputProps = $props()
    let invalid = $state<boolean>(false)
    let text = $state<string>(value.toString())

    $inspect(value)

    $effect(() => {
        text = text.trim();
        const num = Number(text); // parseFloat does not work here, but we need to check for "", because in this case Number("") returns 0, which is not correct
        // console.log(typeof value, "value", value, "number:", num);

        if (text !== "" && !Number.isNaN(num) && isValidInput(text, num)) {
            invalid = false;
            value = num
        } else {
            invalid = true;
        }
    })

</script>


<input type="text" {...props} class="form-control {props.class}" class:form-control-error={invalid} bind:value={text}/>


<style>
    @import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';


    .form-control:focus {
        border-color: rgb(160, 160, 160);
        box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075), 0 0 8px rgba(160, 160, 160, 0.9);
    }

    .form-control-error {
        border-color: rgb(255, 0, 0);
    }

    .form-control-error:focus {
        border-color: rgb(255, 0, 0);
        box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075), 0 0 8px rgba(255, 0, 0, 0.6);
    }

</style>