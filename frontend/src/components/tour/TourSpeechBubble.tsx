"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { TourStep, useTourStore } from "@/store/tourStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TourSpeechBubble: React.FC = () => {
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

  // Get the current steps array based on section
  const steps = currentSection === 1 ? getActiveSection1Steps() : section2Steps;

  // Get the current step
  const currentStep = steps[currentStepIndex];

  // Check if this is the welcome step (Section 1, Step 1)
  const isWelcomeStep = currentSection === 1 && currentStepIndex === 0;

  // Check if current step has no target (needs backdrop)
  const hasNoTarget = !currentStep?.target;

  // Calculate appropriate positions for the speech bubble and mascot relative to the target element
  useEffect(() => {
    if (!isActive || !speechBubbleRef.current || !mascotRef.current) {
      setOverlayVisible(false);
      return;
    }

    setOverlayVisible(true);
    const speechBubble = speechBubbleRef.current;
    const mascot = mascotRef.current;

    // Default positioning (center of screen) for steps without a target
    let bubbleTop = window.innerHeight / 2 - 100;
    let bubbleLeft = window.innerWidth / 2 - 175;
    let mascotTop = bubbleTop + 20; // Default position for welcome step
    let mascotLeft = bubbleLeft - 150; // Always position mascot to the left of bubble

    if (currentStep.target) {
      const targetElement = document.querySelector(
        currentStep.target
      ) as HTMLElement | null;
      if (targetElement) {
        const targetRect = targetElement.getBoundingClientRect();
        const placement = currentStep.placement || "right";

        // Position based on placement but always keep mascot aligned with bubble
        switch (placement) {
          case "top":
            bubbleTop = targetRect.top - 180;
            bubbleLeft = targetRect.left + targetRect.width / 2 - 150;
            mascotTop = bubbleTop + 20; // Consistent with welcome step
            mascotLeft = bubbleLeft - 150;
            break;
          case "right":
            bubbleTop = targetRect.top;
            bubbleLeft = targetRect.right + 120;
            mascotTop = bubbleTop + 20; // Consistent with welcome step
            mascotLeft = bubbleLeft - 150;
            break;
          case "bottom":
            bubbleTop = targetRect.bottom + 20;
            bubbleLeft = targetRect.left + targetRect.width / 2 - 150;
            mascotTop = bubbleTop + 20; // Consistent with welcome step
            mascotLeft = bubbleLeft - 150;
            break;
          case "left":
            bubbleTop = targetRect.top;
            bubbleLeft = targetRect.left - 350;
            mascotTop = bubbleTop + 20; // Consistent with welcome step
            mascotLeft = bubbleLeft - 150;
            break;
          case "center":
          default:
            bubbleTop = window.innerHeight / 2 - 100;
            bubbleLeft = window.innerWidth / 2 - 175;
            mascotTop = bubbleTop + 20; // Default welcome position
            mascotLeft = bubbleLeft - 150;
            break;
        }
      }
    }

    // Keep bubble on screen
    bubbleTop = Math.max(20, Math.min(bubbleTop, window.innerHeight - 280));
    bubbleLeft = Math.max(150, Math.min(bubbleLeft, window.innerWidth - 370)); // Ensure enough room for mascot on left

    // Position the elements
    speechBubble.style.top = `${bubbleTop}px`;
    speechBubble.style.left = `${bubbleLeft}px`;

    // Always use tail-left to consistently point to the mascot
    speechBubble.className = `speech-bubble tail-left`;

    mascot.style.top = `${mascotTop}px`;
    mascot.style.left = `${mascotLeft}px`;
  }, [isActive, currentStep, currentStepIndex]);

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
      <div ref={speechBubbleRef} className="speech-bubble tail-left">
        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-primary mb-2">
            {currentStep.title}
          </h3>

          <p className="text-base mb-4">{currentStep.content}</p>

          <div className="flex justify-between items-center mt-auto">
            <div className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {steps.length}
            </div>
            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <Button variant="outline" onClick={prevStep} className="px-3">
                  Back
                </Button>
              )}
              <Button
                onClick={nextStep}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4"
              >
                {currentStepIndex === steps.length - 1 ? "Finish" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mascot - increased size */}
      <div ref={mascotRef} className="mascot-container">
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
