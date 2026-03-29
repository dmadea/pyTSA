import { writable } from 'svelte/store';

// Define types for WebSocket data
export interface WebSocketData {
  data: Float32Array;
  shape: number[];
  name: string;
}

// Define types for WebSocket connection status
export interface WebSocketStatus {
  status: 'Connected' | 'Disconnected' | 'Error';
  errorMessage: string;
  transferTime: number;
  dataSize: string;
}

// Create stores for WebSocket data and status
export const wsData = writable<WebSocketData | null>(null);
export const wsStatus = writable<WebSocketStatus>({
  status: 'Disconnected',
  errorMessage: '',
  transferTime: 0,
  dataSize: ''
});

// Available WebSocket endpoints
export const endpoints = [
  { id: 'test-data', name: 'Test Data (1000×1000)', url: 'ws://localhost:8000/ws/test-data' },
  { id: 'matrix-a', name: 'Matrix A', url: 'ws://localhost:8000/ws/matrix-a' },
  { id: 'matrix-b', name: 'Matrix B', url: 'ws://localhost:8000/ws/matrix-b' }
];

// Format bytes to human-readable format
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Connect to WebSocket endpoint
export function connectWebSocket(url: string): WebSocket {
  let socket: WebSocket | null = null;
  
  try {
    // Update status to connecting
    wsStatus.update(status => ({
      ...status,
      status: 'Disconnected',
      errorMessage: ''
    }));
    
    // Connect to the WebSocket endpoint
    socket = new WebSocket(url);
    
    socket.onopen = () => {
      wsStatus.update(status => ({
        ...status,
        status: 'Connected',
        errorMessage: ''
      }));
      console.log(`WebSocket connection established to ${url}`);
    };
    
    socket.onmessage = (event) => {
      if (event.data instanceof Blob) {
        // Handle binary data
        const startTime = performance.now();
        
        // Convert blob to ArrayBuffer
        event.data.arrayBuffer().then(buffer => {
          // Create a Float32Array from the buffer
          const floatArray = new Float32Array(buffer);
          
          // Calculate transfer time
          const endTime = performance.now();
          const transferTime = endTime - startTime;
          
          // Calculate data size
          const bytes = buffer.byteLength;
          const dataSize = formatBytes(bytes);
          
          // Update status with transfer info
          wsStatus.update(status => ({
            ...status,
            transferTime,
            dataSize
          }));
          
          console.log(`Received binary data: ${bytes} bytes in ${transferTime.toFixed(2)}ms`);
          
          // Send acknowledgment back to the server
          socket?.send('Binary data received successfully');
        });
      } else {
        // Handle JSON metadata
        const message = JSON.parse(event.data);
        console.log('Received metadata:', message);
        
        if (message.type === 'binary_data') {
          // Store the shape information for later use
          wsData.set({
            data: new Float32Array(0), // Placeholder, will be updated when binary data arrives
            shape: message.shape,
            name: message.name || 'Unnamed Data'
          });
        }
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      wsStatus.update(status => ({
        ...status,
        status: 'Error',
        errorMessage: 'Connection error occurred'
      }));
    };
    
    socket.onclose = () => {
      wsStatus.update(status => ({
        ...status,
        status: 'Disconnected'
      }));
      console.log('WebSocket connection closed');
    };
  } catch (error) {
    console.error('Error creating WebSocket:', error);
    wsStatus.update(status => ({
      ...status,
      status: 'Error',
      errorMessage: 'Failed to create WebSocket connection'
    }));
  }
  
  return socket as WebSocket;
}

// Disconnect WebSocket
export function disconnectWebSocket(socket: WebSocket | null) {
  if (socket) {
    socket.close();
  }
}

// Send ping message
export function ping(socket: WebSocket | null) {
  socket?.send('ping');
} 