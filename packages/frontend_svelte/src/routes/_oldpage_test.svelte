<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Graph from './Graph.svelte';

  import { 
    connectWebSocket, 
    disconnectWebSocket, 
    ping, 
    endpoints, 
    wsData, 
    wsStatus
  } from '$lib/websocket';
  import type { WebSocketData } from '$lib/websocket';
  
  let socket: WebSocket | null = null;
  let selectedEndpoint: string = 'test-data';
  let receivedData: WebSocketData | null = null;
  let connectionStatus: string = 'Disconnected';
  let errorMessage: string = '';
  let transferTime: number = 0;
  let dataSize: string = '';
  
  // Subscribe to the stores
  const unsubscribeData = wsData.subscribe(value => {
    receivedData = value;
  });
  
  const unsubscribeStatus = wsStatus.subscribe(value => {
    connectionStatus = value.status;
    errorMessage = value.errorMessage;
    transferTime = value.transferTime;
    dataSize = value.dataSize;
  });
  
  function handleEndpointChange() {
    const selectedEndpointObj = endpoints.find(e => e.id === selectedEndpoint);
    if (selectedEndpointObj) {
      socket = connectWebSocket(selectedEndpointObj.url);
    }
  }
  
  onMount(() => {
    // Connect to default endpoint when component is mounted
    const defaultEndpoint = endpoints.find(e => e.id === selectedEndpoint);
    if (defaultEndpoint) {
      socket = connectWebSocket(defaultEndpoint.url);
    }
    
    // Clean up on component destruction
    return () => {
      disconnectWebSocket(socket);
      unsubscribeData();
      unsubscribeStatus();
    };
  });
</script>

<div class="container">
  <h1>pyTSA WebSocket Binary Data Test</h1>
  
  <div class="status-container">
    <p>Connection Status: <span class="status {connectionStatus.toLowerCase()}">{connectionStatus}</span></p>
    {#if errorMessage}
      <p class="error">{errorMessage}</p>
    {/if}
  </div>
  
  <div class="endpoint-selector">
    <label for="endpoint-select">Select Data Endpoint:</label>
    <select id="endpoint-select" bind:value={selectedEndpoint} on:change={handleEndpointChange}>
      {#each endpoints as endpoint}
        <option value={endpoint.id}>{endpoint.name}</option>
      {/each}
    </select>
  </div>
  
  <div class="controls">
    <button on:click={() => handleEndpointChange()} disabled={connectionStatus === 'Connected'}>Connect</button>
    <button on:click={() => disconnectWebSocket(socket)} disabled={connectionStatus !== 'Connected'}>Disconnect</button>
    <button on:click={() => ping(socket)}>Ping</button>
  </div>
  
  {#if receivedData && receivedData.data.length > 0}
    <div class="data-container">
      <h2>Received Binary Data: {receivedData.name}</h2>
      <p>Shape: {receivedData.shape.join(' × ')}</p>
      <p>Transfer Time: {transferTime.toFixed(2)} ms</p>
      <p>Data Size: {dataSize}</p>
      
      <div class="data-info">
        <p>Binary data received successfully. Displaying a sample of the data:</p>
        <p>First 10 values: {Array.from(receivedData.data.slice(0, 10)).map(v => v.toFixed(4)).join(', ')}</p>
      </div>
    </div>
  {:else}
    <p>No data received yet. Connect to the WebSocket to receive test data.</p>
  {/if}


  <Graph />
</div>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
  }
  
  .status-container {
    margin: 20px 0;
    padding: 10px;
    border-radius: 4px;
    background-color: #f5f5f5;
  }
  
  .status {
    font-weight: bold;
  }
  
  .status.connected {
    color: green;
  }
  
  .status.disconnected {
    color: gray;
  }
  
  .status.error {
    color: red;
  }
  
  .error {
    color: red;
    font-weight: bold;
  }
  
  .endpoint-selector {
    margin: 20px 0;
  }
  
  select {
    padding: 8px;
    margin-left: 10px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
  
  .controls {
    margin: 20px 0;
  }
  
  button {
    padding: 8px 16px;
    margin-right: 10px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
  
  .data-container {
    margin-top: 20px;
  }
  
  .data-info {
    margin-top: 20px;
    padding: 15px;
    background-color: #f9f9f9;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
</style>
