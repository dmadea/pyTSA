<script>
    let count = $state(0);
    </script>
    <h2>
        And we can have interactive content like this
    </h2>
    <p>
        The count is: {count}
    </p>
    <button onclick={()=> count += 1}>
        Increment
    </button>
    <button onclick={()=> count -= 1}>
        Decrement
    </button>
    
    
    <style>
        button {
            border-radius: .25rem;
            cursor: pointer;
            font-weight: bold;
            background-color: #fff;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            max-width: 250px;
        }
        button:active {
            background-color: #efefef;
            box-shadow: 0 0px 0px 0 rgba(0, 0, 0, 0.1), 0 0px 0px 0 rgba(0, 0, 0, 0.06);	
        }
    </style>