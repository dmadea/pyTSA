<script lang="ts">
    import Figure from "$lib/Figure.svelte";
    import Scene from "$lib/Scene.svelte";

</script>

<svelte:head>
  <style>
    html, body {
      background: AliceBlue;
      height: 87%;
    }
  </style>
</svelte:head>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<Scene templateCols="2fr 1fr 2fr" templateRows="1fr 1fr">
  <Figure row=1 col=1 rowspan=1 colspan=1/>
  <Figure row=1 col=2/> 
  <Figure row=2 col=1/>
  <Figure row=2 col=2 colspan=2/>
</Scene>


<style>
</style>