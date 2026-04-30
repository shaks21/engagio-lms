'use client';

import React, { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CheckCircle2, GripVertical } from 'lucide-react';

const quizOptionSchema = z.object({
  text: z.string().min(1, 'Option text is required'),
  isCorrect: z.boolean(),
});

const quizQuestionSchema = z.object({
  question: z.string().min(3, 'Question must be at least 3 characters'),
  points: z.number().min(1).max(100),
  options: z.array(quizOptionSchema).min(2, 'At least 2 options required').max(6, 'Max 6 options'),
});

const quizFormSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1, 'At least one question required').max(50, 'Max 50 questions'),
});

export type QuizFormData = z.infer<typeof quizFormSchema>;

interface QuizCreatorFormProps {
  sessionId: string;
  onCreateQuiz: (questions: QuizFormData['questions']) => Promise<void>;
}

export default function QuizCreatorForm({ sessionId, onCreateQuiz }: QuizCreatorFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<QuizFormData>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: {
      questions: [
        {
          question: '',
          points: 10,
          options: [
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
          ],
        },
      ],
    },
  });

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control,
    name: 'questions',
  });

  const onSubmit = async (data: QuizFormData) => {
    setIsSubmitting(true);
    try {
      await onCreateQuiz(data.questions);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-engagio-400" />
          <span className="text-sm font-semibold text-white">Create Quiz</span>
        </div>
        <span className="text-xs text-gray-500">{questionFields.length} / 50</span>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3 space-y-4"
        data-testid="quiz-creator-form"
      >
        <AnimatePresence>
          {questionFields.map((qField, qIdx) => (
            <QuestionCard
              key={qField.id}
              control={control}
              qIdx={qIdx}
              register={register}
              watch={watch}
              setValue={setValue}
              removeQuestion={() => removeQuestion(qIdx)}
              canRemove={questionFields.length > 1}
              errors={errors}
            />
          ))}
        </AnimatePresence>

        <button
          type="button"
          onClick={() =>
            appendQuestion({
              question: '',
              points: 10,
              options: [
                { text: '', isCorrect: false },
                { text: '', isCorrect: false },
              ],
            })
          }
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-600 rounded-xl text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          data-testid="add-question-btn"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>

        {errors.questions?.root && (
          <p className="text-xs text-red-400 mt-1">{errors.questions.root.message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 bg-engagio-600 hover:bg-engagio-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          data-testid="submit-quiz-btn"
        >
          {isSubmitting ? 'Creating…' : 'Create Quiz'}
        </button>
      </form>
    </div>
  );
}

function QuestionCard({
  control,
  qIdx,
  register,
  watch,
  setValue,
  removeQuestion,
  canRemove,
  errors,
}: {
  control: any;
  qIdx: number;
  register: any;
  watch: any;
  setValue: any;
  removeQuestion: () => void;
  canRemove: boolean;
  errors: any;
}) {
  const {
    fields: optionFields,
    append: appendOption,
    remove: removeOption,
  } = useFieldArray({
    control,
    name: `questions.${qIdx}.options`,
  });

  const options = watch(`questions.${qIdx}.options`);
  const correctCount = options?.filter((o: any) => o.isCorrect)?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="border border-gray-700/60 rounded-xl bg-gray-800/30 overflow-hidden"
    >
      <div className="flex items-start gap-2 px-3 py-2.5 border-b border-gray-700/40">
        <GripVertical className="w-4 h-4 text-gray-500 mt-2 shrink-0" />
        <div className="flex-1 min-w-0">
          <input
            {...register(`questions.${qIdx}.question`)}
            placeholder={`Question ${qIdx + 1}`}
            className="w-full bg-transparent text-sm font-semibold text-white placeholder-gray-500 focus:outline-none"
            data-testid={`question-input-${qIdx}`}
          />
          <input
            type="number"
            {...register(`questions.${qIdx}.points`, { valueAsNumber: true })}
            className="w-16 bg-transparent text-xs text-engagio-300 font-mono mt-1 focus:outline-none border-b border-gray-600 focus:border-engagio-500"
            data-testid={`points-input-${qIdx}`}
          />
          <span className="text-[10px] text-gray-500 ml-1">pts</span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={removeQuestion}
            className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
            title="Remove question"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="px-3 py-2 space-y-1.5">
        {optionFields.map((optField, oIdx) => (
          <div key={optField.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register(`questions.${qIdx}.options.${oIdx}.isCorrect`)}
              className="w-4 h-4 rounded border-gray-600 accent-engagio-500 shrink-0"
              data-testid={`correct-checkbox-${qIdx}-${oIdx}`}
            />
            <input
              {...register(`questions.${qIdx}.options.${oIdx}.text`)}
              placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
              className="flex-1 bg-gray-700/40 border border-gray-600/50 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-engagio-500"
              data-testid={`option-input-${qIdx}-${oIdx}`}
            />
            {optionFields.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(oIdx)}
                className="text-gray-500 hover:text-red-400 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {correctCount > 1 && (
          <p className="text-[11px] text-yellow-400 mt-1">Only one option should be correct.</p>
        )}
        {optionFields.length < 6 && (
          <button
            type="button"
            onClick={() => appendOption({ text: '', isCorrect: false })}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mt-1"
          >
            <Plus className="w-3 h-3" /> Add Option
          </button>
        )}
      </div>
    </motion.div>
  );
}
