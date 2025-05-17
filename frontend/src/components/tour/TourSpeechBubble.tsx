"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { TourStep, useTourStore } from "@/store/tourStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { TextRoll } from "@/components/motion-primitives/text-roll";

const TourSpeechBubble = () => {
  const {
    isActive,
    currentSection,
    currentStepIndex,
    section1Steps,
    section2Steps,
    getActiveSection1Steps,
    endTour,
    nextStep,
    prevStep,
  } = useTourStore();

  const speechBubbleRef = useRef<HTMLDivElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);

  // Add key state to force animation reset
  const [animationKey, setAnimationKey] = useState(0);

  // Get the current steps array based on section
  const steps = currentSection === 1 ? getActiveSection1Steps() : section2Steps;

  // Get the current step
  const currentStep = steps[currentStepIndex];

  // Check if this is the welcome step (Section 1, Step 1)
  const isWelcomeStep = currentSection === 1 && currentStepIndex === 0;

  // Check if this is data input step (Section 1, Step 2)
  const isDataInputStep = currentSection === 1 && currentStepIndex === 1;

  // Check if current step has no target (needs backdrop)
  const hasNoTarget = !currentStep?.target;

  // Track tail position for speech bubble
  const [bubbleTailPosition, setBubbleTailPosition] = useState("tail-left");

  // Calculate appropriate positions for the speech bubble and mascot relative to the target element
  useEffect(() => {
    if (!isActive || !speechBubbleRef.current || !mascotRef.current) {
      setOverlayVisible(false);
      return;
    }

    setOverlayVisible(true);
    const speechBubble = speechBubbleRef.current;
    const mascot = mascotRef.current;

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Set base positioning - will be overridden by specific cases
    let bubbleTop = viewportHeight / 2 - 100;
    let bubbleLeft = viewportWidth / 2 - 175;
    let mascotTop = bubbleTop + 20;
    let mascotLeft = bubbleLeft - 150;
    let tailPosition = "tail-left"; // Default tail position

    // Special handling for Section 1 Step 2 (data-input)
    const isDataInputStep = currentSection === 1 && currentStepIndex === 1;

    if (currentStep.target) {
      const targetElement = document.querySelector(
        currentStep.target
      ) as HTMLElement | null;

      if (targetElement) {
        const targetRect = targetElement.getBoundingClientRect();
        const placement = currentStep.placement || "right";

        // Track if we're on a small screen
        const isSmallScreen = viewportWidth < 768;

        switch (placement) {
          case "top":
            // Calculate relative position - percentage of viewport
            bubbleTop = Math.max(20, targetRect.top - viewportHeight * 0.15);
            bubbleLeft = targetRect.left + targetRect.width / 2 - 150;
            mascotTop = bubbleTop + 20;
            mascotLeft = bubbleLeft - 150;
            break;

          case "right":
            bubbleTop = targetRect.top;
            // Use percentage of viewport width for positioning
            bubbleLeft = Math.min(
              viewportWidth - 380,
              targetRect.right + viewportWidth * 0.05
            );
            mascotTop = bubbleTop + 20;
            mascotLeft = bubbleLeft - 150;
            break;

          case "bottom":
            bubbleTop = Math.min(
              viewportHeight - 280,
              targetRect.bottom + viewportHeight * 0.05
            );
            bubbleLeft = targetRect.left + targetRect.width / 2 - 150;
            mascotTop = bubbleTop + 20;
            mascotLeft = bubbleLeft - 150;
            break;

          case "left":
            if (isDataInputStep) {
              // Improved positioning for CSV upload step (Section 1, Step 2)
              if (isSmallScreen) {
                // On small screens, position differently
                bubbleTop = Math.max(20, targetRect.top - 50);
                bubbleLeft = Math.max(20, targetRect.left - 320);
                mascotTop = bubbleTop + 180; // Below bubble on small screens
                mascotLeft = bubbleLeft + 100;
                tailPosition = "tail-bottom"; // Point downward to Marty
              } else {
                // Fixed positions for Section 1 Step 2 on larger screens
                // Position speech bubble on the left side with some fixed offsets
                bubbleTop = Math.max(20, targetRect.top + 150); // Keep bubble vertical position
                bubbleLeft = Math.max(20, targetRect.left - 300); // Keep bubble horizontal position unchanged

                // Position Marty to align exactly with the right tail of the speech bubble
                // The tail is usually positioned about 1/3 of the way down the bubble
                mascotTop = bubbleTop - 10; // Keep Marty's vertical position
                mascotLeft = bubbleLeft + 340; // Move Marty further to the left (was +370)
                tailPosition = "tail-right"; // Point right towards the upload area
              }
            } else {
              // Default left placement for other steps
              bubbleTop = targetRect.top;
              bubbleLeft = Math.max(150, targetRect.left - viewportWidth * 0.2);
              mascotTop = bubbleTop + 20;
              mascotLeft = bubbleLeft - 150;
            }
            break;

          case "center":
          default:
            // Center positioning is already viewport-relative
            bubbleTop = viewportHeight / 2 - 100;
            bubbleLeft = viewportWidth / 2 - 175;
            mascotTop = bubbleTop + 20;
            mascotLeft = bubbleLeft - 150;
            break;
        }
      }
    }

    // Special handling for Section 1 Step 2 (data-input) even if target not found
    if (isDataInputStep) {
      // Default positioning for Section 1 Step 2 in case target isn't found
      bubbleTop = Math.max(20, viewportHeight * 0.35); // Keep bubble vertical position
      bubbleLeft = Math.max(20, viewportWidth * 0.27); // Keep bubble horizontal position

      // Position Marty to align with the right tail of the speech bubble
      mascotTop = bubbleTop - 10; // Keep Marty's vertical position
      mascotLeft = bubbleLeft + 340; // Move Marty further to the left (was +370)
      tailPosition = "tail-right";
    }

    // Apply safe minimum and maximum bounds to ensure visibility
    bubbleTop = Math.max(20, Math.min(bubbleTop, viewportHeight - 280));
    bubbleLeft = Math.max(20, Math.min(bubbleLeft, viewportWidth - 370));
    mascotTop = Math.max(20, Math.min(mascotTop, viewportHeight - 150));
    mascotLeft = Math.max(20, Math.min(mascotLeft, viewportWidth - 150));

    // Position the elements
    speechBubble.style.top = `${bubbleTop}px`;
    speechBubble.style.left = `${bubbleLeft}px`;
    speechBubble.className = `speech-bubble ${tailPosition}`;
    setBubbleTailPosition(tailPosition); // Update state with the current tail position
    mascot.style.top = `${mascotTop}px`;
    mascot.style.left = `${mascotLeft}px`;
  }, [isActive, currentStep, currentStepIndex, currentSection]);

  // Highlight the target element
  useEffect(() => {
    if (!isActive || !currentStep.target) return;

    const targetElement = document.querySelector(currentStep.target);
    if (!targetElement) return;

    const htmlElement = targetElement as HTMLElement;
    const originalZIndex = htmlElement.style.zIndex;
    const originalPosition = htmlElement.style.position;

    // Highlight the element
    htmlElement.style.position = "relative";
    htmlElement.style.zIndex = "1000";
    targetElement.classList.add("tour-highlight");

    return () => {
      // Cleanup
      htmlElement.style.position = originalPosition;
      htmlElement.style.zIndex = originalZIndex;
      targetElement.classList.remove("tour-highlight");
    };
  }, [isActive, currentStep]);

  // Handle clicking outside to close the tour
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isActive &&
        speechBubbleRef.current &&
        mascotRef.current &&
        !speechBubbleRef.current.contains(event.target as Node) &&
        !mascotRef.current.contains(event.target as Node)
      ) {
        // Check if clicking on the highlighted element, don't close in that case
        if (currentStep.target) {
          const targetElement = document.querySelector(currentStep.target);
          if (targetElement && targetElement.contains(event.target as Node)) {
            return;
          }
        }

        endTour();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isActive, currentStep, endTour]);

  // Handle next step animation reset
  const handleNextStep = () => {
    setAnimationKey((prev) => prev + 1); // Update key to force animation restart
    nextStep();
  };

  // Handle previous step animation reset
  const handlePrevStep = () => {
    setAnimationKey((prev) => prev + 1); // Update key to force animation restart
    prevStep();
  };

  if (!isActive || !currentStep) {
    return null;
  }

  return (
    <>
      {/* Regular overlay - only for non-welcome steps with targets */}
      {overlayVisible && !hasNoTarget && (
        <div className="tour-overlay" onClick={() => endTour()} />
      )}

      {/* Special backdrop overlay for welcome step or any step without a target */}
      {hasNoTarget && (
        <div className="tour-backdrop-overlay" onClick={() => endTour()} />
      )}

      {/* Speech Bubble - now using theme-aware styles */}
      <div
        ref={speechBubbleRef}
        className={`speech-bubble ${
          isDataInputStep ? "data-input-step-bubble" : ""
        } ${bubbleTailPosition}`}
        style={{
          ...(isDataInputStep
            ? {
                position: "absolute",
                zIndex: 1001,
                transformOrigin: "center right",
              }
            : {}),
        }}
      >
        <div className="flex flex-col">
          {/* Use TextRoll for title with 3D flip animation */}
          <TextRoll
            key={`title-${animationKey}-${currentStepIndex}`}
            className="text-lg font-bold text-primary mb-2"
            duration={0.2}
          >
            {currentStep.title}
          </TextRoll>

          {/* Use TextEffect for content with a fade-in animation */}
          <TextEffect
            key={`content-${animationKey}-${currentStepIndex}`}
            as="p"
            className="text-base mb-4"
            preset="fade"
            per="word"
            delay={0.3}
            speedReveal={1}
          >
            {currentStep.content}
          </TextEffect>

          <div className="flex justify-between items-center mt-auto">
            <div className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {steps.length}
            </div>
            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrevStep}
                  className="px-3"
                >
                  Back
                </Button>
              )}
              <Button
                onClick={handleNextStep}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4"
              >
                {currentStepIndex === steps.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mascot - increased size */}
      <div
        ref={mascotRef}
        className={`mascot-container ${
          isDataInputStep ? "data-input-step-mascot" : ""
        }`}
        style={{
          ...(isDataInputStep
            ? {
                position: "absolute",
                zIndex: 1000,
                transform: "translateY(-15px)", // Adjust vertical positioning
              }
            : {}),
        }}
      >
        <div className="w-36 h-36 relative">
          <Image
            src={currentStep.image}
            alt="Tour guide mascot"
            fill
            style={{ objectFit: "contain" }}
            priority
          />
        </div>
      </div>
    </>
  );
};

export default TourSpeechBubble;
