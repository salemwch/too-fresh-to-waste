'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import styles from './ProductStepsCarousel.module.css';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/pagination';

/**
 * ProductStepsCarousel - Step-by-step guide carousel
 *
 * Features:
 * - Custom card shape with clip-path cutout for step number
 * - Responsive breakpoints (1 → 2 → 3 slides)
 * - Auto-height slides
 * - Clickable pagination
 * - Matches original design from carrousel.md exactly
 */

interface Step {
  number: number;
  title: string;
  description: string;
  image: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Plan Ahead',
    description:
      'Write down 3 key tasks you want to accomplish today before checking your phone.',
    image: 'https://arman-borkhani.github.io/codepen-cpc-css-shape/assets/plan.jpg',
  },
  {
    number: 2,
    title: 'Get Moving',
    description:
      'Do a short workout, stretch, or walk to activate your energy and improve your focus.',
    image: 'https://arman-borkhani.github.io/codepen-cpc-css-shape/assets/moving.jpg',
  },
  {
    number: 3,
    title: 'Find Calm',
    description:
      'Spend a few quiet minutes meditating, journaling, or just breathing mindfully before diving into work.',
    image: 'https://arman-borkhani.github.io/codepen-cpc-css-shape/assets/calm.jpg',
  },
];

export default function ProductStepsCarousel() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-[#f5f5f5]">
      <section className="w-full max-w-[940px] px-4 py-10 text-center">
        {/* Section Header */}
        <h2 className="text-[1.8rem] leading-[1.2] font-bold mb-2 text-[#1a1a1a]">
          3 Simple Steps to Start Your Day Productively
        </h2>
        <p className="text-[#555] text-base leading-[1.5] mb-10">
          Boost your focus and energy from the moment you wake up with these easy daily habits.
        </p>

        {/* Swiper Carousel */}
        <Swiper
          modules={[Pagination, Autoplay]}
          spaceBetween={20}
          slidesPerView={1}
          autoHeight={true}
          pagination={{
            el: `.${styles['swiperPagination']}`,
            clickable: true,
          }}
          breakpoints={{
            768: {
              slidesPerView: 2,
            },
            1024: {
              slidesPerView: 3,
            },
          }}
          className="w-full"
        >
          {steps.map((step) => (
            <SwiperSlide key={step.number}>
              <article className="relative">
                {/* Step Number Circle - Positioned absolutely at top-right */}
                <div className="absolute top-0 right-0 w-[60px] h-[60px] bg-white rounded-full text-2xl flex justify-center items-center font-bold text-[#1a1a1a] z-10">
                  {step.number}
                </div>

                {/* Card with custom shape */}
                <div
                  className={`bg-white p-6 w-full text-left rounded-[30px] ${styles['cardShape']}`}
                >
                  {/* Card Title */}
                  <h3 className="text-[1.2rem] font-bold mb-2.5 pr-[70px] text-[#1a1a1a]">
                    {step.title}
                  </h3>

                  {/* Card Description */}
                  <p className="text-[0.875rem] leading-[1.5] text-[#666] mb-3 pr-[65px]">
                    {step.description}
                  </p>

                  {/* Card Image */}
                  <figure className="h-[200px] bg-[#eee] rounded-[20px] relative overflow-hidden">
                    <img
                      className="absolute inset-0 w-full h-full object-cover"
                      src={step.image}
                      alt={step.title}
                    />
                  </figure>
                </div>
              </article>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Pagination */}
        <div className={styles['swiperPagination']}></div>
      </section>
    </div>
  );
}
