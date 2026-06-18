<script setup>
import { useRouter }    from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth   = useAuthStore()

// staff → scan workflow, everyone else → dashboard
router.replace(auth.role === 'staff' ? '/scan' : '/dashboard')
</script>
