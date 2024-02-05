<script setup lang="ts">
// copied from https://bestjquery.com/tutorial/preloader/demo419/
</script>

<template>
    <div class="loader">
        <div class="inner_loader"></div>
        <div class="inner_loader"></div>
        <div class="inner_loader"></div>
        <div class="inner_loader"></div>
    </div>
</template>


<style>
:root{ --color: #006688; }
.loader{
    width: 100px;
    height: 100px;
    margin: 0 auto;
    position: relative;
    animation: rotateAnim 2s infinite ease;
}
.loader .inner_loader{
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: 1px solid var(--color);
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
    animation: translateAnim 2s infinite ease;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.1);
}
.loader .inner_loader:nth-child(1){
    top: -25px;
    animation: translateAnimTop 2s infinite ease;
}
.loader .inner_loader:nth-child(2){
    left: 25px;
    animation: translateAnimRight 2s infinite ease;
}
.loader .inner_loader:nth-child(3){
    top: 25px;
    animation: translateAnimBottom 2s infinite ease;
}
.loader .inner_loader:nth-child(4){
    left: -25px;
    animation: translateAnimLeft 2s infinite ease;
}
@keyframes rotateAnim{
     0% { transform: rotate(0deg); }
    25% { transform: rotate(90deg); }
    50% { transform: rotate(90deg); }
    75% { transform: rotate(180deg); }
   100% { transform: rotate(180deg); }
}
@keyframes translateAnimTop{
    0% {
        background: var(--color);
        transform: translateY(0px);
    }
    25% {
        background: var(--color);
        transform: translateY(0px);
    }
    50% {
        background: none;
        transform: translateY(-20px);
    }
    75% {
        background: none;
        transform: translateY(-20px);
    }
    100% {
        background: var(--color);
        transform: translateY(0px);
    }
}
@keyframes translateAnimBottom{
    0% {
        background: var(--color);
        transform: translateY(0px);
    }
    25% {
        background: var(--color);
        transform: translateY(0px);
    }
    50% {
        background: none;
        transform: translateY(20px);
    }
    75% {
        background: none;
        transform: translateY(20px);
    }
    100% {
        background: var(--color);
        transform: translateY(0px);
    }
}
@keyframes translateAnimLeft{
    0% {
        background: var(--color);
        transform: translateX(0px);
    }
    25% {
        background: var(--color);
        transform: translateX(0px);
    }
    50% {
        background: none;
        transform: translateX(-20px);
    }
    75% {
        background: none;
        transform: translateX(-20px);
    }
    100% {
        background: var(--color);
        transform: translateX(0px);
    }
}
@keyframes translateAnimRight{
    0% {
        background: var(--color);
        transform: translateX(0px);
    }
    25% {
        background: var(--color);
        transform: translateX(0px);
    }
    50% {
        background: none;
        transform: translateX(20px);
    }
    75% {
        background: none;
        transform: translateX(20px);
    }
    100% {
        background: var(--color);
        transform: translateX(0px);
    }
}
</style>