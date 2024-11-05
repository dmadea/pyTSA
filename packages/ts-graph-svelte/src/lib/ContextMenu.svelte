<script lang="ts">

    // from https://svelte.dev/playground/6fb90919e24942b2b47d9ad154386b0c?version=3.49.0#H4sIAAAAAAAAE7VZC2_bOBL-K7MqDkkPtuQkTXtVbN8VbXc318e23eD6WC0utDiS2FCkSlJ-1Of_fiAl2ZKjPIrDGQhsUTPfvIccZu0JkqMXeh9Ymhl4zll8Bc-lMLg08AZF6Q28hHHUXvjH2jOrwtLaBW_QcD4rCl_PkRu7NiMa-9ZjCymM9kJvrGPFCjONRGRYXkhlGoFWHiRK5nDgB621GubgLBLjYMctxm2-YBoJb-DZZy80qsTN4AaFryN3Fe993zbgp-EQIvELM1k5g3_Q8gpFTlRKBvDPkq_geHR8HIm2E4Fp0DnhHHL7ZDJigDJdcLJCCosMBZQaFSgbhGHsgmAyhFyWGkEKmCm50Kj8SFxkTFyBTIAZIBoILMgKjASdyQV8wEShzkAWhklhGd-wWEktEwMfmaByoStpbUFSAEV9ZWThR-KVkAsBszINIwEAMITzxKlSawBcEqrdSu0RSKRyzwlT2oBhOQ6cNs5wjcZqlxCu0a8gf0UR4wAWCDERQhpI0Ti_-BkQQaufK6AsR6GZFAPQTMS1vGVFChnRYHlniALInDBOZhyBGHjx25ta0MVWKWcuVOYuGOeO1eoooFCyQMVXPX6J41JpIEqWgjoLkaYIhzNpjMyhIMpUcqzSlQS79tAGp-Ux32bqudAFU0hddoedAoPMmEKHQVClmk9xHigseHBCTk6eHJ_GJ4TOHiWnT2aPHs9Onz5JnlJCcRQf_X2OyvpncuIfn_qjSAyHVVVsK8QqFwRQSG0T0FojlX1iLjt2BkPL4IqLo3FsE1jDMoTRAFYhjGCzxczrrN5GCQ4zdFjWGwtGTeYc0Q7aDtpxW-ysD7t2XLBwGXuriB1kk583om5T0taiIQZb6g2dQnOm2YxxZlY72C3XpMrhsy2ekU0Jg5Y5gsXZ8dXFcWYDYteSUsTO687hrs222swhPlxXdPbTkmn72O5Fy8bdov0sQqic5TMhUH20vhl0SbIuya_OkzuSzdnudx34Lv8yBPRjzlCYT3vQq92rz_2IQWDbSKtw9lOjqsoZ7rpih5kkptsdB7bCBMQZESm6atumdVV9Hfa2JB8uMqZ35LYwpDBKco4UZiu4NLK4dCl2yTExl11FDDDBmUDQZsXRh66NQhsk9Jpxrk6abu_2NyMLsOiOtFuXHcT-pjSwzf-axyrk2skW3N9BsQQOm36UwdDF2F_BuO67D7sBrV5O6u9hTdSPtmjQlg3aogdtWaMtG7RFRbPZqw4p3pEUXXl0ayII4EJCTq729gHKNCkKJMq5qkNfbZ42vhYOKcjSaEaxpydBt-ralb6vYYqmVbgvmt50KCS9prBNtC2ji1fatIad_jXA9bALMmcpaZK02q0m05u7g207dYOcgFXHl0mi0eyXuqVz3bNL5prGjqpp0de6SCVi0NOAOvybfvcRSs8N5odtV9W90rdeeV4fKiYQec8odXXIDOa-70deP2ShmDD3AnxnKZHegvVdyvvp9kVKeZtSCnM5x3tBfXCkt2ml0Rgm0nuh_V7R6utwzcZr_W8b_B87sL0oH9iD8EEIB3W0DvaifSCFK9GDsInnPkHdlC5waQ7COpSWLvL2KWNOtLayEjLUkjMKCRkWvNQHrVwa3K0q5oVZsVgK_b9r-9JiwXksxT311d9KovAHNba5douu9vVdin6R8r4uzUkqWLJiIh2m7v2PKeuKzLadWzR2NHep7GrwvmlgaX9Q0Uy1NbwPR11dt-VNTXKXbU3t3dO8FIn6v1tnFNHZLaZVjeouyy4syj3NchKHMRE9tv3pBpTdDD-uhp4wQ0LrgcVN159laafD5oBn69oGQQOJY6koE6k9f69kqcAQbdCH5xXlpVPpEuaElwhMwOW25V0Cmck5WkaFhUJtW6aDcG3DBzc_bVUYcztoK-STyHOHPZ0hmsiDTGEyibzAcgWx1kGepJzM9L8dDBo_1jrypi24O5CaATCm4qv2Yy5LmnCi0I9lHpCvZBlwNtNBIoUZkgXaaSN47B_5R0464dzPmaikgt3gUsXMysrKyOnR8fBVcpUsPr_Qr6_O-eJ98fj1z4L_7ftb-vqXZfn087NnR-_ni_O3V_rRuyx-yd__Pv8Wr_71-vWLp-RN9okenZTvv8pP5uWrt1L_9pF8-fYpRT5KJ5PIA3u3oKViKROTyCNCipU9dUUeKExQKVSF5Cy2ygg5bNYiz13WjINu8MfON7XP_tpO6IJQG_IQRq2Zwt64MLFbq3c5X5D5jKgWd53LYX1yHyYcly2cmVQUVQhHxRIejEYjcIncInAHmxCOnoyKDh-Jr1J3NzCMJZcqhAcnJyfXgIeKUFbqELrcco4q4XIRQsYoRdF6ZfUbUqbQbf4hxJKXuei1Ekq-vu6Rx1tJNXXJgbM-j8y4jK9aojnTZujCMLQ3ZyEIKbDHFYnqEQCz0hgpWnJcxmr2HUM4Upi3gBqPUdrn6dHoL63V6sAZwnHXg25uJ5ylInTTTk9IfyBgPYaEmQ3S-rrSo9HoR_TYZsDpXeog4s3qAOutiGLZ_ruN3d8eVHpsSpLkLk_A9A6MW9VvYSyIEkyk1xFixXIt91I9TLmcEX7YBvOZSGSF-PA6jCDzVRcja4exyY693K6DVc3PVTuotrQHcRz39J3TfY-Pg6aBRWJM2RzcVjSJmqvjyIMZEzQ0GdOTdb24mX5o3cDZ1r7IUOFP44CyuYNaP2DJduizYgSZ29vi8IZJtLqZmERec6EQAplpyUuDZ_beIVy7sX5TLM9cvlbPy02xjLxmw2prX3Uau7XQ1tN055BxyVtP9rN-gCTOWsMG0W6I23TJKlKWVAOePbDAxI4wmYq8HlInK1PTHpAQucabWDibjusakCJ0jp6sncj6FLSZjlltbrXufm-m44BNq4XWcWgzDiqw6TjgrE-ZgCV7qqwD64_W4jjY-qwJ9DgQxH7X7LujUX0LalWvom3d-p9C4RyFeYEJKbmZrHuvFTcQiZ3JrbuVjduA9_9f8ufmv_eYJUEOGgAA

    interface ContextMenuItem {
        type: 'action' | 'divider' | "checkbox",
        label?: String,
        onClick?: () => void
    }

    const items: ContextMenuItem[] = [
        {
            type: "action",
            label: "Copy plot to clipboard",
            onClick: () => {return}
        },
        {
            type: "divider",
        },
        {
            type: "action",
            label: "Copy figure",
            onClick: () => {return}
        }

    ]

    let pos = $state({ x: 0, y: 0 })
    // menu is dimension (height and width) of context menu
    let menu = { h: 0, y: 0 }
    // browser/window dimension (height and width)
    let browser = { h: 0, y: 0 }
    // showMenu is state of context-menu visibility
    let showMenu = $state<boolean>(false)

    function rightClickContextMenu(e: MouseEvent){
        if (e.ctrlKey) {
            return
        }

        e.preventDefault()
        showMenu = true
        browser = {
            w: window.innerWidth,
            h: window.innerHeight
        };
        pos = {
            x: e.clientX,
            y: e.clientY
        };
        console.log("rightClickContextMenu", pos, menu)
        // If bottom part of context menu will be displayed
        // after right-click, then change the position of the
        // context menu. This position is controlled by `top` and `left`
        // at inline style. 
        // Instead of context menu is displayed from top left of cursor position
        // when right-click occur, it will be displayed from bottom left.
        if (browser.h -  pos.y < menu.h)
            pos.y = pos.y - menu.h
        if (browser.w -  pos.x < menu.w)
            pos.x = pos.x - menu.w
    }

    function onPageClick(e){
        // To make context menu disappear when
        // mouse is clicked outside context menu
        showMenu = false;
    }

    function getContextMenuDimension(node){
        // This function will get context menu dimension
        // when navigation is shown => showMenu = true
        let height = node.offsetHeight
        let width = node.offsetWidth
        menu = {
            h: height,
            w: width
        }
    }

</script>

<svelte:window oncontextmenu={rightClickContextMenu} on:click={onPageClick} />

{#if showMenu}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<ul use:getContextMenuDimension oncontextmenu={(e: MouseEvent) => e.preventDefault()} 
     class="dropdown-menu show menu" style="left: {pos.x}px; top: {pos.y}px">
    {#each items as item}
        {#if item.type === "divider"}
            <li><hr class="dropdown-divider" /></li>
        {:else if item.type === "checkbox"}
            <div class="dropdown-divider"></div>
        {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_invalid_attribute -->
        <li><button class="dropdown-item small" onclick={() => item.onClick?.()}>{item.label}</button></li>
        {/if}
    {/each}
</ul>
{/if}


<style>
    @import 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';

    ul {
        padding: 0px 0px;
    }

    hr  {
        margin: 0px 0px;
    }

    .menu {
        border-radius: 1px;
    }

    button {
        margin: 0px 0px;
        padding: 5px 10px;
    }
</style>