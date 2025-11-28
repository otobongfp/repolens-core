"""Embedding batcher service"""
import asyncio
import json
import time
import hashlib
import uuid
from typing import Dict, List, Tuple
from redis.asyncio import Redis

from app.adapters.base import BaseAdapter
from app.config import settings

def sha_key(*parts: str) -> str:
    """Generate SHA256 key for caching"""
    h = hashlib.sha256()
    for p in parts:
        h.update(str(p).encode())
    return h.hexdigest()

class EmbedBatcher:
    """Batches embedding requests for efficiency"""
    
    def __init__(self, adapters: Dict[str, BaseAdapter]):
        self.adapters = adapters
        self.settings = settings
        self.queue = asyncio.Queue()
        self.redis = None
    
    async def start_redis(self):
        """Connect to Redis"""
        self.redis = Redis.from_url(settings.redis_url, decode_responses=False)
    
    async def close_redis(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.aclose()
    
    async def process_embed_request(self, adapter: BaseAdapter, inputs: List[str]) -> Dict:
        """Process single embedding request through batching system"""
        keys = [sha_key(adapter.name(), adapter.version(), text) for text in inputs]
        if self.redis:
            cached = await self.redis.mget(keys)
            if all(x is not None for x in cached):
                vectors = [json.loads(x) for x in cached]
                return {
                    "adapter_name": adapter.name(),
                    "adapter_version": adapter.version(),
                    "vectors": vectors,
                    "cached": [True] * len(vectors)
                }
        
        job_uuid = str(uuid.uuid4())
        future = asyncio.get_event_loop().create_future()
        await self.queue.put((job_uuid, adapter, inputs, future))
        
        adapter_name, adapter_version, vectors, cached_flags = await asyncio.wait_for(
            future, timeout=30.0
        )
        
        return {
            "adapter_name": adapter_name,
            "adapter_version": adapter_version,
            "vectors": vectors,
            "cached": cached_flags
        }
    
    async def run(self):
        """Main batching loop"""
        while True:
            batch = []
            start_time = time.time()
            
            item = await self.queue.get()
            batch.append(item)
            
            while len(batch) < self.settings.max_batch:
                try:
                    wait_time = (self.settings.max_batch_wait_ms / 1000.0) - (time.time() - start_time)
                    if wait_time <= 0:
                        break
                    item = await asyncio.wait_for(self.queue.get(), timeout=wait_time)
                    batch.append(item)
                except asyncio.TimeoutError:
                    break
            
            await self._process_batch(batch)
    
    async def _process_batch(self, batch: List[Tuple]):
        """Process a batch of requests"""
        try:
            if not batch:
                return
            adapter = batch[0][1]
            
            flat_inputs = []
            mapping = []
            
            for job_uuid, adapter, inputs, future in batch:
                for i, text in enumerate(inputs):
                    flat_inputs.append(text)
                    mapping.append((job_uuid, i, future))
            
            keys = [sha_key(adapter.name(), adapter.version(), text) for text in flat_inputs]
            cached_results = await self.redis.mget(keys) if self.redis else [None] * len(flat_inputs)
            
            to_call = []
            to_call_indices = []
            vectors = [None] * len(flat_inputs)
            cached_flags = [False] * len(flat_inputs)
            
            for i, val in enumerate(cached_results):
                if val is None:
                    to_call.append(flat_inputs[i])
                    to_call_indices.append(i)
                else:
                    vectors[i] = json.loads(val)
                    cached_flags[i] = True
            
            if to_call:
                call_results = await adapter.embed_batch(to_call)
                for idx_local, vec in enumerate(call_results):
                    idx_global = to_call_indices[idx_local]
                    vectors[idx_global] = vec
                    if self.redis:
                        await self.redis.set(keys[idx_global], json.dumps(vec), ex=60*60*24*30)
            
            results_by_job = {}
            for (job_uuid, pos, _), vec, cached_flag in zip(mapping, vectors, cached_flags):
                results_by_job.setdefault(job_uuid, []).append((pos, vec, cached_flag))
            
            for job_uuid, adapter, inputs, future in batch:
                parts = sorted(results_by_job[job_uuid], key=lambda x: x[0])
                res_vectors = [p[1] for p in parts]
                res_cached = [p[2] for p in parts]
                if not future.cancelled():
                    future.set_result((adapter.name(), adapter.version(), res_vectors, res_cached))
        
        except Exception as e:
            for _, _, _, fut in batch:
                if not fut.cancelled():
                    fut.set_exception(e)

