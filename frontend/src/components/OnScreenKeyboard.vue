<template>
  <div>
    <div class="flex flex-col gap-2">
      <div v-for="(row, i) in rows" :key="i" class="flex gap-2 justify-center">
        <button
          v-for="key in row"
          :key="key"
          type="button"
          class="rounded-xl font-bold active:opacity-50 transition-opacity flex items-center justify-center select-none"
          style="height:60px; min-width:40px; flex:1; max-width:58px; background:var(--card); border:2px solid var(--border); color:var(--text); font-size:19px; -webkit-tap-highlight-color:transparent; touch-action:manipulation;"
          @click="$emit('key', key)"
        >{{ key }}</button>
      </div>

      <!-- Bottom row: backspace + clear -->
      <div class="flex gap-2 justify-center mt-1">
        <button
          type="button"
          class="rounded-xl font-bold active:opacity-50 transition-opacity flex items-center justify-center flex-1 select-none"
          style="height:60px; max-width:170px; background:var(--card); border:2px solid var(--border); color:var(--muted); font-size:17px; -webkit-tap-highlight-color:transparent; touch-action:manipulation;"
          @click="$emit('clear')"
        >Löschen</button>
        <button
          type="button"
          class="rounded-xl font-bold active:opacity-50 transition-opacity flex items-center justify-center flex-1 select-none"
          style="height:60px; max-width:170px; background:var(--card); border:2px solid var(--border); color:var(--text); font-size:24px; -webkit-tap-highlight-color:transparent; touch-action:manipulation;"
          @click="$emit('backspace')"
          aria-label="Ein Zeichen löschen"
        >⌫</button>
      </div>
    </div>

    <button
      v-if="showEnter"
      type="button"
      class="w-full rounded-2xl font-bold text-xl tracking-wide mt-3 transition-opacity active:opacity-70 select-none"
      style="height:80px; background:var(--accent); color:#fff; -webkit-tap-highlight-color:transparent; touch-action:manipulation;"
      :style="enterDisabled ? 'opacity:.4;' : ''"
      :disabled="enterDisabled"
      @click="$emit('enter')"
    >{{ enterLabel }}</button>
  </div>
</template>

<script setup>
const props = defineProps({
  showEnter:     { type: Boolean, default: true },
  showNumbers:   { type: Boolean, default: true },
  enterLabel:    { type: String,  default: 'Weiter' },
  enterDisabled: { type: Boolean, default: false },
})

defineEmits(['key', 'backspace', 'clear', 'enter'])

const letterRows = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M'],
]

const rows = props.showNumbers
  ? [['1','2','3','4','5','6','7','8','9','0'], ...letterRows]
  : letterRows
</script>
