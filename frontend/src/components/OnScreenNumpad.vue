<template>
  <div>
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="n in [1,2,3,4,5,6,7,8,9]"
        :key="n"
        type="button"
        class="rounded-xl font-bold text-2xl active:opacity-60 transition-opacity flex items-center justify-center"
        style="height:56px; background:var(--card); border:1px solid var(--border); color:var(--text); -webkit-tap-highlight-color:transparent;"
        @click="$emit('digit', String(n))"
      >{{ n }}</button>

      <button
        v-if="allowDecimal"
        type="button"
        class="rounded-xl font-bold text-2xl active:opacity-60 transition-opacity flex items-center justify-center"
        style="height:56px; background:var(--card); border:1px solid var(--border); color:var(--text); -webkit-tap-highlight-color:transparent;"
        @click="$emit('digit', '.')"
      >.</button>
      <div v-else></div>

      <button
        type="button"
        class="rounded-xl font-bold text-2xl active:opacity-60 transition-opacity flex items-center justify-center"
        style="height:56px; background:var(--card); border:1px solid var(--border); color:var(--text); -webkit-tap-highlight-color:transparent;"
        @click="$emit('digit', '0')"
      >0</button>

      <button
        type="button"
        class="rounded-xl font-bold text-xl active:opacity-60 transition-opacity flex items-center justify-center"
        style="height:56px; background:var(--card); border:1px solid var(--border); color:var(--muted); -webkit-tap-highlight-color:transparent;"
        @click="$emit('backspace')"
        aria-label="Löschen"
      >⌫</button>
    </div>

    <button
      v-if="showEnter"
      type="button"
      class="w-full rounded-xl font-bold text-lg tracking-wide mt-2 transition-opacity active:opacity-80"
      style="height:56px; background:var(--accent); color:#fff; -webkit-tap-highlight-color:transparent;"
      :style="enterDisabled ? 'opacity:.4;' : ''"
      :disabled="enterDisabled"
      @click="$emit('enter')"
    >{{ enterLabel }}</button>
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
