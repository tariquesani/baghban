<script>
  let { onDimensions, onPlan } = $props();
</script>

<h2>Set up your garden</h2>
<p>Choose how to give the garden a scale. Layout tools stay hidden until that is done.</p>
<button type="button" class="choice" onclick={onDimensions}>Enter dimensions</button>
<button type="button" class="choice" onclick={onPlan}>Upload a plan</button>

<style>
  h2 {
    margin: 0 0 8px;
    font-size: 1.25rem;
    font-weight: 500;
  }

  p {
    margin: 0 0 20px;
    color: #42493d;
    font-size: 0.95rem;
    line-height: 1.45;
  }

  .choice {
    display: block;
    width: 100%;
    margin-bottom: 10px;
    padding: 12px 14px;
    border: 1px solid #c2c9bb;
    border-radius: 8px;
    background: #fff;
    color: #191d17;
    font: inherit;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
  }

  .choice:hover { background: #eef4ea; }
</style>
