<template>
  <div>
    <div class="flex flex-col gap-1.5">
      <div v-for="(row, i) in rows" :key="i" class="flex gap-1.5 justify-center">
        <button
          v-for="key in row"
          :key="key"
          type="button"
          class="rounded-lg font-semibold active:opacity-60 transition-opacity flex items-center justify-center"
          style="height:44px; min-width:30px; flex:1; max-width:42px; background:var(--card); border:1px solid var(--border); color:var(--text); font-size:15px; -webkit-tap-highlight-color:transparent;"
          @click="$emit('key', key)"
        >{{ key }}</button>
      </div>

      <!-- Bottom row: backspace + clear -->
      <div class="flex gap-1.5 justify-center mt-1">
        <button
          type="button"
          class="rounded-lg font-semibold active:opacity-60 transition-opacity flex items-center justify-center flex-1"
          style="height:44px; max-width:140px; background:var(--card); border:1px solid var(--border); color:var(--muted); font-size:14px; -webkit-tap-highlight-color:transparent;"
          @click="$emit('clear')"
        >Löschen</button>
        <button
          type="button"
          class="rounded-lg font-semibold active:opacity-60 transition-opacity flex items-center justify-center flex-1"
          style="height:44px; max-width:140px; background:var(--card); border:1px solid var(--border); color:var(--text); font-size:18px; -webkit-tap-highlight-color:transparent;"
          @click="$emit('backspace')"
          aria-label="Ein Zeichen löschen"
        >⌫</button>
      </div>
    </div>

    <button
      v-if="showEnter"
      type="button"
      class="w-full rounded-xl font-bold text-lg tracking-wide mt-3 transition-opacity active:opacity-80"
      style="height:56px; background:var(--accent); color:#fff; -webkit-tap-highlight-color:transparent;"
      :style="enterDisabled ? 'opacity:.4;' : ''"
      :disabled="enterDisabled"
      @click="$emit('enter')"
    >{{ enterLabel }}</button>
  </div>
</template>

<script setup>
defineProps({
  showEnter:     { type: Boolean, default: true },
  enterLabel:    { type: String,  default: 'Weiter' },
  enterDisabled: { type: Boolean, default: false },
})

defineEmits(['key', 'backspace', 'clear', 'enter'])

const rows = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M'],
]
</script>
