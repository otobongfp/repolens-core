import Hero from './components/Hero';

export default function Home() {
  return (
    <div className='bg-background relative flex min-h-screen flex-col overflow-auto overflow-x-hidden'>
      <main className='relative z-10 flex flex-1 flex-col items-center px-4'>
        <Hero />
      </main>
    </div>
  );
}
