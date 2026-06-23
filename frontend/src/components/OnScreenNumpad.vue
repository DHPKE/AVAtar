<template>
  <div>
    <div class="grid grid-cols-3 gap-3">
      <button
        v-for="n in [1,2,3,4,5,6,7,8,9]"
        :key="n"
        type="button"
        class="rounded-2xl font-bold active:opacity-50 transition-opacity flex items-center justify-center select-none"
        style="height:88px; font-size:2.25rem; background:var(--card); border:2px solid var(--border); color:var(--text); -webkit-tap-highlight-color:transparent; touch-action:manipulation;"
        @click="$emit('digit', String(n))"
      >{{ n }}</button>

      <button
        v-if="allowDecimal"
        type="button"
        class="rounded-2xl font-bold active:opacity-50 transition-opacity flex items-center justify-center select-none"
        style="height:88px; font-size:2.25rem; background:var(--card); border:2px solid var(--border); color:var(--text); -webkit-tap-highlight-color:transparent; touch-action:manipulation;"
        @click="$emit('digit', '.')"
      >.</button>
      <div v-else></div>

      <button
        type="button"
        class="rounded-2xl font-bold active:opacity-50 transition-opacity flex items-center justify-center select-none"
        style="height:88px; font-size:2.25rem; background:var(--card); border:2px solid var(--border); color:var(--text); -webkit-tap-highlight-color:transparent; touch-action:manipulation;"
        @click="$emit('digit', '0')"
      >0</button>

      <button
        type="button"
        class="rounded-2xl font-bold active:opacity-50 transition-opacity flex items-center justify-center select-none"
        style="height:88px; font-size:1.75rem; background:var(--card); border:2px solid var(--border); color:var(--muted); -webkit-tap-highlight-color:transparent; touch-action:manipulation;"
        @click="$emit('backspace')"
        aria-label="Löschen"
      >⌫</button>
    </div>

    <button
      v-if="showEnter"
      type="button"
      class="w-full rounded-2xl font-bold tracking-wide mt-3 transition-opacity active:opacity-70 select-none flex items-center justify-center gap-2"
      style="height:80px; font-size:1.4rem; background:var(--accent); color:#fff; -webkit-tap-highlight-color:transparent; touch-action:manipulation;"
      :style="enterDisabled ? 'opacity:.4;' : ''"
      :disabled="enterDisabled"
      @click="$emit('enter')"
    ><slot name="enter-icon" />{{ enterLabel }}</button>
  </div>
</template>

<script setup>
defineProps({
  allowDecimal:  { type: Boolean, default: false },
  showEnter:     { type: Boolean, default: true },
  enterLabel:    { type: String,  default: 'Bestätigen' },
  enterDisabled: { type: Boolean, default: false },
})

defineEmits(['digit', 'backspace', 'enter'])
</script>
